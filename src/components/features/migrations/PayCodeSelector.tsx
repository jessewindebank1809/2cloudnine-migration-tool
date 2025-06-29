'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface PayCodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (payCodeExternalId: string) => void;
  breakpointName?: string;
}

export function PayCodeSelector({ 
  isOpen, 
  onClose, 
  onSelect,
  breakpointName 
}: PayCodeSelectorProps) {
  const [externalId, setExternalId] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalId.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSelect(externalId.trim());
      setExternalId('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fix Missing Pay Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paycode">Pay Code External ID</Label>
            <Input
              id="paycode"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="Enter pay code external ID (e.g., 100106)"
              disabled={isSubmitting}
            />
            {breakpointName && (
              <p className="text-sm text-muted-foreground">
                For breakpoint: {breakpointName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the external ID of the pay code to assign to this Daily Hours Breakpoint.
              The pay code must have a 'Payment' record type.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!externalId.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Breakpoint'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}