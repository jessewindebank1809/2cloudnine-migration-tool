import { migration_projects, session_status } from '@prisma/client';
import { migrationSessionManager } from './migration-session-manager';
import { DataExtractor } from './data-extractor';
import { DataLoader } from './data-loader';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ObjectDiscoveryEngine } from '@/lib/salesforce/object-discovery';

export interface MigrationOptions {
  objectTypes: string[];
  batchSize?: number;
  useBulkApi?: boolean;
  preserveRelationships?: boolean;
  allowPartialSuccess?: boolean;
  maxConcurrentBatches?: number;
}

export interface MigrationResult {
  sessionId: string;
  success: boolean;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  duration: number;
  errors: any[];
}

export class MigrationEngine {
  private dataExtractor = new DataExtractor();
  private dataLoader = new DataLoader();
  private abortController: AbortController | null = null;

  /**
   * Execute a migration project
   */
  async executeMigration(
    project: migration_projects,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const results: MigrationResult[] = [];

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Validate project
      await this.validateProject(project);

      // Determine migration order based on object dependencies
      const orderedObjects = await this.determineObjectOrder(
        project.source_org_id,
        options.objectTypes
      );

      // Migrate each object type in order
      for (const objectType of orderedObjects) {
        if (this.abortController.signal.aborted) {
          throw new Error('Migration cancelled');
        }

        const result = await this.migrateObject(
          project,
          objectType,
          options
        );

        results.push(result);

        // Stop if critical object failed and partial success not allowed
        if (!result.success && !options.allowPartialSuccess) {
          break;
        }
      }

      // Calculate overall result
      return this.consolidateResults(results, Date.now() - startTime);

    } catch (error) {
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Migrate a single object type
   */
  private async migrateObject(
    project: migration_projects,
    objectType: string,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    // Create migration session
    const session = await migrationSessionManager.createSession(
      project.id,
      objectType
    );

    try {
      // Start session
      await migrationSessionManager.startSession(session.id);

      // Get record count
      const totalRecords = await this.dataExtractor.getRecordCount(
        project.source_org_id,
        objectType
      );

      // Update session with total records
      await migrationSessionManager.updateProgress(session.id, {
        totalRecords
      });

      // Check if we should preserve relationships
      if (options.preserveRelationships) {
        return await this.migrateWithRelationships(
          project,
          session.id,
          objectType,
          options
        );
      } else {
        return await this.migrateSimple(
          project,
          session.id,
          objectType,
          options
        );
      }

    } catch (error) {
      // Fail the session
      await migrationSessionManager.failSession(
        session.id,
        error instanceof Error ? error.message : 'Unknown error'
      );

      const sessionData = await migrationSessionManager.getSession(session.id);
      
      return {
        sessionId: session.id,
        success: false,
        totalRecords: sessionData.total_records,
        successfulRecords: sessionData.successful_records,
        failedRecords: sessionData.failed_records,
        duration: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Simple migration without relationship preservation
   */
  private async migrateSimple(
    project: migration_projects,
    sessionId: string,
    objectType: string,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    let batchNumber = 0;
    let totalBatches = 0;

    // Extract and load data in batches
    const extractor = this.dataExtractor.extractRecordsBatched(
      project.source_org_id,
      objectType,
      { batchSize: options.batchSize }
    );

    for await (const batch of extractor) {
      if (this.abortController?.signal.aborted) {
        await migrationSessionManager.cancelSession(sessionId);
        break;
      }

      batchNumber++;
      
      // Update progress
      await migrationSessionManager.updateProgress(sessionId, {
        currentBatch: batchNumber,
        totalBatches
      });

      // Load batch into target
      const loadResult = await this.dataLoader.loadRecords(
        project.source_org_id,
        project.target_org_id,
        objectType,
        batch,
        {
          useBulkApi: options.useBulkApi,
          allowPartialSuccess: options.allowPartialSuccess
        }
      );

      // Record results
      for (const [sourceId, targetId] of Array.from(loadResult.idMapping.entries())) {
        const sourceRecord = batch.find(r => r.Id === sourceId);
        await migrationSessionManager.recordSuccess(
          sessionId,
          sourceId,
          targetId,
          sourceRecord
        );
      }

      for (const error of loadResult.errors) {
        const sourceRecord = batch[error.index];
        await migrationSessionManager.recordFailure(
          sessionId,
          error.sourceId || sourceRecord?.Id || '',
          error.error,
          sourceRecord
        );
      }
    }

    // Complete session
    await migrationSessionManager.completeSession(sessionId);

    // Get final results
    const session = await migrationSessionManager.getSession(sessionId);
    const duration = session.completedAt && session.startedAt
      ? session.completedAt.getTime() - session.startedAt.getTime()
      : 0;

    return {
      sessionId,
      success: session.failedRecords === 0,
      totalRecords: session.totalRecords,
      successfulRecords: session.successfulRecords,
      failedRecords: session.failedRecords,
      duration,
      errors: []
    };
  }

  /**
   * Migration with relationship preservation
   */
  private async migrateWithRelationships(
    project: migration_projects,
    sessionId: string,
    objectType: string,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    // First, extract all records to analyze relationships
    const allRecords = await this.dataExtractor.extractAllRecords(
      project.source_org_id,
      objectType
    );

    // Extract relationship information
    const { records, relationships } = await this.dataExtractor.extractWithRelationships(
      project.source_org_id,
      objectType,
      allRecords
    );

    // Get parent records if needed
    const parentIdMappings = new Map<string, Map<string, string>>();
    if (relationships.size > 0) {
      // TODO: Get ID mappings from previous migrations
      // For now, extract parent records
      const parentRecords = await this.dataExtractor.extractParentRecords(
        project.source_org_id,
        relationships
      );
    }

    // Load records with relationship preservation
    const loadResult = await this.dataLoader.loadWithRelationships(
      project.source_org_id,
      project.target_org_id,
      objectType,
      records,
      parentIdMappings,
      {
        useBulkApi: options.useBulkApi,
        allowPartialSuccess: options.allowPartialSuccess
      }
    );

    // Record results
    for (const [sourceId, targetId] of Array.from(loadResult.idMapping.entries())) {
      const sourceRecord = records.find(r => r.Id === sourceId);
      await migrationSessionManager.recordSuccess(
        sessionId,
        sourceId,
        targetId,
        sourceRecord
      );
    }

    for (const error of loadResult.errors) {
      const sourceRecord = records[error.index];
      await migrationSessionManager.recordFailure(
        sessionId,
        error.sourceId || sourceRecord?.Id || '',
        error.error,
        sourceRecord
      );
    }

    // Complete session
    await migrationSessionManager.completeSession(sessionId);

    // Get final results
    const session = await migrationSessionManager.getSession(sessionId);
    const duration = session.completedAt && session.startedAt
      ? session.completedAt.getTime() - session.startedAt.getTime()
      : 0;

    return {
      sessionId,
      success: session.failedRecords === 0,
      totalRecords: session.totalRecords,
      successfulRecords: session.successfulRecords,
      failedRecords: session.failedRecords,
      duration,
      errors: []
    };
  }

  /**
   * Validate migration project
   */
  private async validateProject(project: migration_projects): Promise<void> {
    // Check org health
    const healthyOrgs = await sessionManager.areAllOrgsHealthy([
      project.source_org_id,
      project.target_org_id
    ]);

    if (!healthyOrgs) {
      throw new Error('One or more organizations are not healthy');
    }

    // Check API limits
    const sourceCapabilities = await sessionManager.getCapabilities(project.source_org_id);
    const targetCapabilities = await sessionManager.getCapabilities(project.target_org_id);

    if (!sourceCapabilities.permissions.canAccessSetup) {
      throw new Error('Insufficient permissions in source org');
    }

    if (!targetCapabilities.permissions.canModifyMetadata) {
      throw new Error('Insufficient permissions in target org');
    }
  }

  /**
   * Determine object migration order based on dependencies
   */
  private async determineObjectOrder(
    orgId: string,
    objectTypes: string[]
  ): Promise<string[]> {
    const client = await sessionManager.getClient(orgId);
    const discoveryEngine = new ObjectDiscoveryEngine(client);

    // Get all object details
    const objectDetails = await Promise.all(
      objectTypes.map(obj => discoveryEngine.getObjectDetails(obj))
    );

    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();
    const objects = new Map<string, any>();

    for (const obj of objectDetails) {
      if (!obj) continue;
      
      objects.set(obj.name, obj);
      dependencies.set(obj.name, new Set());

      // Find dependencies (parent relationships)
      for (const field of obj.fields) {
        if (field.type === 'reference' && field.referenceTo) {
          for (const ref of field.referenceTo) {
            if (objectTypes.includes(ref)) {
              dependencies.get(obj.name)?.add(ref);
            }
          }
        }
      }
    }

    // Topological sort
    return this.topologicalSort(objectTypes, dependencies);
  }

  /**
   * Topological sort for dependency ordering
   */
  private topologicalSort(
    nodes: string[],
    dependencies: Map<string, Set<string>>
  ): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: string) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected involving ${node}`);
      }

      visiting.add(node);

      const deps = dependencies.get(node) || new Set();
      for (const dep of Array.from(deps)) {
        if (nodes.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    };

    for (const node of nodes) {
      visit(node);
    }

    return sorted;
  }

  /**
   * Consolidate results from multiple object migrations
   */
  private consolidateResults(
    results: MigrationResult[],
    totalDuration: number
  ): MigrationResult {
    const consolidated: MigrationResult = {
      sessionId: results[0]?.sessionId || '',
      success: results.every(r => r.success),
      totalRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      duration: totalDuration,
      errors: []
    };

    for (const result of results) {
      consolidated.totalRecords += result.totalRecords;
      consolidated.successfulRecords += result.successfulRecords;
      consolidated.failedRecords += result.failedRecords;
      consolidated.errors.push(...result.errors);
    }

    return consolidated;
  }

  /**
   * Cancel ongoing migration
   */
  cancelMigration(): void {
    this.abortController?.abort();
  }
}

// Export singleton instance
export const migrationEngine = new MigrationEngine(); 