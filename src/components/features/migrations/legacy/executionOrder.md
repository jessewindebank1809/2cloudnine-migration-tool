There are two scenarios for external ids from source:

1. Unmanaged field: $externalFieldName = 'External_ID_Data_Creation__c',
2. Managed field: $externalFieldName = 'tc9_edc__External_ID_Data_Creation__c'

The following is the execution order for the migration:

1. interpretationRuleMaster

"SELECT Id, Name, RecordType.Name, tc9_et__Apply_4_Week_Frequency__c,
tc9_et__Apply_Break_Loading_Interpretation__c,
tc9_et__Apply_Break_Time_Interpretation__c, tc9_et__Apply_Casual_Loading__c,
tc9_et__Apply_Dual_Leave_Loading_Calculations__c,
tc9_et__Apply_Excursion_Interpretation__c,
tc9_et__Apply_Interpretation_Variations__c,
tc9_et__Apply_Minimum_Rest_Interpretation__c,
tc9_et__Apply_Minimum_Rest_on_Overtime__c,
tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c,
tc9_et__Apply_Overnight_Interpretation__c,
tc9_et__Apply_Overnight_Majority_Friday__c,
tc9_et__Apply_Overnight_Majority_Monday__c,
tc9_et__Apply_Overnight_Majority_Public_Holiday__c,
tc9_et__Apply_Overnight_Majority_Saturday__c,
tc9_et__Apply_Overnight_Majority_Sunday__c,
tc9_et__Apply_Overnight_Majority_Thursday__c,
tc9_et__Apply_Overnight_Majority_Tuesday__c,
tc9_et__Apply_Overnight_Majority_Wednesday__c,
tc9_et__Apply_Overnight_Majority_Weekday__c,
tc9_et__Apply_Partial_Daily_Rates__c, tc9_et__Apply_Penalty_Loading__c,
tc9_et__Apply_Shift_End_Or_Start_Interpretation__c,
tc9_et__Apply_Sleepover_Interpretation__c,
tc9_et__Apply_Split_Broken_Shift_Interpretation__c,
tc9_et__Apply_Wake_Up_Interpretation__c, tc9_et__Assignment__c,
tc9_et__Break_Loading_Hours_Exceeded__c,
tc9_et__Break_Loading_Unpaid_Break_Minutes__c,
tc9_et__Broken_Shift_Breakpoint_Application__c,
tc9_et__Broken_Shift_Timesheet_Activity_Required__c,
tc9_et__Days_Frequency_Breakpoints_Accrued__c,
tc9_et__Days_Frequency_Breakpoints_Apply__c,
tc9_et__Days_Minimum_Rest_Hours_Apply2__c,
tc9_et__Days_Minimum_Rest_Hours_Apply__c,
tc9_et__Days_Overtime_Breakpoints_Reset__c,
tc9_et__Days_Total_Span_Hours_Apply2__c, tc9_et__Days_Total_Span_Hours_Apply__c,
tc9_et__Exclude_Overtime_from_Frequency_Hours__c,
tc9_et__Excursion_Standard_End_Time__c, tc9_et__Excursion_Standard_Hours__c,
tc9_et__Excursion_Standard_Start_Time__c, tc9_et__Frequency_Standard_Hours__c,
tc9_et__Friday_Interpretation_Type__c, tc9_et__Friday_Standard_Hours__c,
tc9_et__Has_Rate_Calc_Update_Pending__c, tc9_et__Has_Saturday_Rule__c,
tc9_et__Has_Sunday_Rule__c, tc9_et__Higher_Rate_Friday__c,
tc9_et__Higher_Rate_Monday__c, tc9_et__Higher_Rate_Public_Holiday__c,
tc9_et__Higher_Rate_Saturday__c, tc9_et__Higher_Rate_Sunday__c,
tc9_et__Higher_Rate_Thursday__c, tc9_et__Higher_Rate_Tuesday__c,
tc9_et__Higher_Rate_Wednesday__c, tc9_et__Higher_Rate_Weekday__c,
tc9_et__Include_Break_Overtime_In_Overtime__c,
tc9_et__Include_Minimum_Rest_in_Daily_OT_Hours__c,
tc9_et__Include_Paid_Breaks_in_Break_Loading__c,
tc9_et__Include_Time_Breakpoints_In_Overtime__c,
tc9_et__Interpretation_Rule_Builder__c, tc9_et__Interpretation_Rule_Name__c,
tc9_et__Interpretation_Rule_Template_Group__c, tc9_et__Interpretation_Rule__c,
tc9_et__Is_Standard_Time_for_Friday_Required__c,
tc9_et__Is_Standard_Time_for_Monday_Required__c,
tc9_et__Is_Standard_Time_for_Public_Holidays_Req__c,
tc9_et__Is_Standard_Time_for_Saturday_Required__c,
tc9_et__Is_Standard_Time_for_Sunday_Required__c,
tc9_et__Is_Standard_Time_for_Thursday_Required__c,
tc9_et__Is_Standard_Time_for_Tuesday_Required__c,
tc9_et__Is_Standard_Time_for_Wednesday_Required__c,
tc9_et__Is_Standard_Time_for_Weekdays_Required__c,
tc9_et__Last_Date_Rate_Calc_Update_Completed__c,
tc9_et__Last_Rate_Calc_Update_Required__c, tc9_et__Long_Description__c,
tc9_et__Minimum_Frequency_Paid_Hours__c, tc9_et__Minimum_Friday_Paid_Hours__c,
tc9_et__Minimum_Hours_Based_On__c, tc9_et__Minimum_Monday_Paid_Hours__c,
tc9_et__Minimum_OT_Round_Up_Shift_Paid_Hours__c,
tc9_et__Minimum_Public_Holiday_Paid_Hours__c, tc9_et__Minimum_Rest_Hours__c,
tc9_et__Minimum_Saturday_Paid_Hours__c, tc9_et__Minimum_Sunday_Paid_Hours__c,
tc9_et__Minimum_Thursday_Paid_Hours__c, tc9_et__Minimum_Tuesday_Paid_Hours__c,
tc9_et__Minimum_Wednesday_Paid_Hours__c, tc9_et__Minimum_Weekday_Paid_Hours__c,
tc9_et__Monday_Interpretation_Type__c, tc9_et__Monday_Standard_Hours__c,
tc9_et__Overnight_Based_on_Majority_of_Shift__c,
tc9_et__Overnight_Based_on_Shift_Start_Range__c,
tc9_et__Overnight_Friday_Shift_Starting_from__c,
tc9_et__Overnight_Monday_Shift_Starting_from__c,
tc9_et__Overnight_PH_Shift_Starting_from__c,
tc9_et__Overnight_Saturday_Shift_Starting_from__c,
tc9_et__Overnight_Sunday_Shift_Starting_from__c,
tc9_et__Overnight_Thursday_Shift_Starting_from__c,
tc9_et__Overnight_Tuesday_Shift_Starting_from__c,
tc9_et__Overnight_Wednesday_Shift_Starting_from__c,
tc9_et__Overnight_Weekday_Shift_Starting_from__c,
tc9_et__Pay_Code__r."+$externalFieldName+", tc9_et__Public_Holiday_Interpretation_Type__c, tc9_et__Public_Holiday_Standard_Hours__c, tc9_et__Rate_Calculator_Update_Pending__c, tc9_et__Reset_Frequency_Overtime_Daily__c, tc9_et__Saturday_Interpretation_Type__c, tc9_et__Saturday_Standard_Hours__c, tc9_et__Short_Description__c, tc9_et__Sleepover_Breakpoint_Application__c, tc9_et__Sleepover_Minimum_Rest_Hours__c, tc9_et__Standard_Daily_End_Time__c, tc9_et__Standard_Daily_Start_Time__c, tc9_et__Standard_Friday_End_Time__c, tc9_et__Standard_Friday_Start_Time__c, tc9_et__Standard_Monday_End_Time__c, tc9_et__Standard_Monday_Start_Time__c, tc9_et__Standard_Public_Holiday_End_Time__c, tc9_et__Standard_Public_Holiday_Start_Time__c, tc9_et__Standard_Saturday_End_Time__c, tc9_et__Standard_Saturday_Start_Time__c, tc9_et__Standard_Sunday_End_Time__c, tc9_et__Standard_Sunday_Start_Time__c, tc9_et__Standard_Thursday_End_Time__c, tc9_et__Standard_Thursday_Start_Time__c, tc9_et__Standard_Tuesday_End_Time__c, tc9_et__Standard_Tuesday_Start_Time__c, tc9_et__Standard_Wednesday_End_Time__c, tc9_et__Standard_Wednesday_Start_Time__c, tc9_et__Standard_Weekday_End_Time__c, tc9_et__Standard_Weekday_Start_Time__c, tc9_et__Status__c, tc9_et__Sunday_Interpretation_Type__c, tc9_et__Sunday_Standard_Hours__c, tc9_et__Thursday_Interpretation_Type__c, tc9_et__Thursday_Standard_Hours__c, tc9_et__Timesheet_Frequency__c, tc9_et__Total_Span_Hours__c, tc9_et__Tuesday_Interpretation_Type__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Variation_Record_Type__c, tc9_et__Variation_Type__c, tc9_et__Wednesday_Interpretation_Type__c, tc9_et__Wednesday_Standard_Hours__c, tc9_et__Weekday_Interpretation_Type__c, tc9_et__Weekday_Standard_Hours__c FROM tc9_et__Interpretation_Rule__c where id = '"+$jb.sfdc.interpretationRuleId+"'"

2. interpretationRuleVariation

"SELECT Id, Name, RecordType.Name, tc9_et__Apply_4_Week_Frequency__c,
tc9_et__Apply_Break_Loading_Interpretation__c,
tc9_et__Apply_Break_Time_Interpretation__c, tc9_et__Apply_Casual_Loading__c,
tc9_et__Apply_Dual_Leave_Loading_Calculations__c,
tc9_et__Apply_Excursion_Interpretation__c,
tc9_et__Apply_Interpretation_Variations__c,
tc9_et__Apply_Minimum_Rest_Interpretation__c,
tc9_et__Apply_Minimum_Rest_on_Overtime__c,
tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c,
tc9_et__Apply_Overnight_Interpretation__c,
tc9_et__Apply_Overnight_Majority_Friday__c,
tc9_et__Apply_Overnight_Majority_Monday__c,
tc9_et__Apply_Overnight_Majority_Public_Holiday__c,
tc9_et__Apply_Overnight_Majority_Saturday__c,
tc9_et__Apply_Overnight_Majority_Sunday__c,
tc9_et__Apply_Overnight_Majority_Thursday__c,
tc9_et__Apply_Overnight_Majority_Tuesday__c,
tc9_et__Apply_Overnight_Majority_Wednesday__c,
tc9_et__Apply_Overnight_Majority_Weekday__c,
tc9_et__Apply_Partial_Daily_Rates__c, tc9_et__Apply_Penalty_Loading__c,
tc9_et__Apply_Shift_End_Or_Start_Interpretation__c,
tc9_et__Apply_Sleepover_Interpretation__c,
tc9_et__Apply_Split_Broken_Shift_Interpretation__c,
tc9_et__Apply_Wake_Up_Interpretation__c, tc9_et__Assignment__c,
tc9_et__Break_Loading_Hours_Exceeded__c,
tc9_et__Break_Loading_Unpaid_Break_Minutes__c,
tc9_et__Broken_Shift_Breakpoint_Application__c,
tc9_et__Broken_Shift_Timesheet_Activity_Required__c,
tc9_et__Days_Frequency_Breakpoints_Accrued__c,
tc9_et__Days_Frequency_Breakpoints_Apply__c,
tc9_et__Days_Minimum_Rest_Hours_Apply2__c,
tc9_et__Days_Minimum_Rest_Hours_Apply__c,
tc9_et__Days_Overtime_Breakpoints_Reset__c,
tc9_et__Days_Total_Span_Hours_Apply2__c, tc9_et__Days_Total_Span_Hours_Apply__c,
tc9_et__Exclude_Overtime_from_Frequency_Hours__c,
tc9_et__Excursion_Standard_End_Time__c, tc9_et__Excursion_Standard_Hours__c,
tc9_et__Excursion_Standard_Start_Time__c, tc9_et__Frequency_Standard_Hours__c,
tc9_et__Friday_Interpretation_Type__c, tc9_et__Friday_Standard_Hours__c,
tc9_et__Has_Rate_Calc_Update_Pending__c, tc9_et__Has_Saturday_Rule__c,
tc9_et__Has_Sunday_Rule__c, tc9_et__Higher_Rate_Friday__c,
tc9_et__Higher_Rate_Monday__c, tc9_et__Higher_Rate_Public_Holiday__c,
tc9_et__Higher_Rate_Saturday__c, tc9_et__Higher_Rate_Sunday__c,
tc9_et__Higher_Rate_Thursday__c, tc9_et__Higher_Rate_Tuesday__c,
tc9_et__Higher_Rate_Wednesday__c, tc9_et__Higher_Rate_Weekday__c,
tc9_et__Include_Break_Overtime_In_Overtime__c,
tc9_et__Include_Minimum_Rest_in_Daily_OT_Hours__c,
tc9_et__Include_Paid_Breaks_in_Break_Loading__c,
tc9_et__Include_Time_Breakpoints_In_Overtime__c,
tc9_et__Interpretation_Rule_Builder__c, tc9_et__Interpretation_Rule_Name__c,
tc9_et__Interpretation_Rule_Template_Group__c, tc9_et__Interpretation_Rule__c,
tc9_et__Is_Standard_Time_for_Friday_Required__c,
tc9_et__Is_Standard_Time_for_Monday_Required__c,
tc9_et__Is_Standard_Time_for_Public_Holidays_Req__c,
tc9_et__Is_Standard_Time_for_Saturday_Required__c,
tc9_et__Is_Standard_Time_for_Sunday_Required__c,
tc9_et__Is_Standard_Time_for_Thursday_Required__c,
tc9_et__Is_Standard_Time_for_Tuesday_Required__c,
tc9_et__Is_Standard_Time_for_Wednesday_Required__c,
tc9_et__Is_Standard_Time_for_Weekdays_Required__c,
tc9_et__Last_Date_Rate_Calc_Update_Completed__c,
tc9_et__Last_Rate_Calc_Update_Required__c, tc9_et__Long_Description__c,
tc9_et__Minimum_Frequency_Paid_Hours__c, tc9_et__Minimum_Friday_Paid_Hours__c,
tc9_et__Minimum_Hours_Based_On__c, tc9_et__Minimum_Monday_Paid_Hours__c,
tc9_et__Minimum_OT_Round_Up_Shift_Paid_Hours__c,
tc9_et__Minimum_Public_Holiday_Paid_Hours__c, tc9_et__Minimum_Rest_Hours__c,
tc9_et__Minimum_Saturday_Paid_Hours__c, tc9_et__Minimum_Sunday_Paid_Hours__c,
tc9_et__Minimum_Thursday_Paid_Hours__c, tc9_et__Minimum_Tuesday_Paid_Hours__c,
tc9_et__Minimum_Wednesday_Paid_Hours__c, tc9_et__Minimum_Weekday_Paid_Hours__c,
tc9_et__Monday_Interpretation_Type__c, tc9_et__Monday_Standard_Hours__c,
tc9_et__Overnight_Based_on_Majority_of_Shift__c,
tc9_et__Overnight_Based_on_Shift_Start_Range__c,
tc9_et__Overnight_Friday_Shift_Starting_from__c,
tc9_et__Overnight_Monday_Shift_Starting_from__c,
tc9_et__Overnight_PH_Shift_Starting_from__c,
tc9_et__Overnight_Saturday_Shift_Starting_from__c,
tc9_et__Overnight_Sunday_Shift_Starting_from__c,
tc9_et__Overnight_Thursday_Shift_Starting_from__c,
tc9_et__Overnight_Tuesday_Shift_Starting_from__c,
tc9_et__Overnight_Wednesday_Shift_Starting_from__c,
tc9_et__Overnight_Weekday_Shift_Starting_from__c,
tc9_et__Pay_Code__r."+$externalFieldName+", tc9_et__Public_Holiday_Interpretation_Type__c, tc9_et__Public_Holiday_Standard_Hours__c, tc9_et__Rate_Calculator_Update_Pending__c, tc9_et__Reset_Frequency_Overtime_Daily__c, tc9_et__Saturday_Interpretation_Type__c, tc9_et__Saturday_Standard_Hours__c, tc9_et__Short_Description__c, tc9_et__Sleepover_Breakpoint_Application__c, tc9_et__Sleepover_Minimum_Rest_Hours__c, tc9_et__Standard_Daily_End_Time__c, tc9_et__Standard_Daily_Start_Time__c, tc9_et__Standard_Friday_End_Time__c, tc9_et__Standard_Friday_Start_Time__c, tc9_et__Standard_Monday_End_Time__c, tc9_et__Standard_Monday_Start_Time__c, tc9_et__Standard_Public_Holiday_End_Time__c, tc9_et__Standard_Public_Holiday_Start_Time__c, tc9_et__Standard_Saturday_End_Time__c, tc9_et__Standard_Saturday_Start_Time__c, tc9_et__Standard_Sunday_End_Time__c, tc9_et__Standard_Sunday_Start_Time__c, tc9_et__Standard_Thursday_End_Time__c, tc9_et__Standard_Thursday_Start_Time__c, tc9_et__Standard_Tuesday_End_Time__c, tc9_et__Standard_Tuesday_Start_Time__c, tc9_et__Standard_Wednesday_End_Time__c, tc9_et__Standard_Wednesday_Start_Time__c, tc9_et__Standard_Weekday_End_Time__c, tc9_et__Standard_Weekday_Start_Time__c, tc9_et__Status__c, tc9_et__Sunday_Interpretation_Type__c, tc9_et__Sunday_Standard_Hours__c, tc9_et__Thursday_Interpretation_Type__c, tc9_et__Thursday_Standard_Hours__c, tc9_et__Timesheet_Frequency__c, tc9_et__Total_Span_Hours__c, tc9_et__Tuesday_Interpretation_Type__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Variation_Record_Type__c, tc9_et__Variation_Type__c, tc9_et__Wednesday_Interpretation_Type__c, tc9_et__Wednesday_Standard_Hours__c, tc9_et__Weekday_Interpretation_Type__c, tc9_et__Weekday_Standard_Hours__c FROM tc9_et__Interpretation_Rule__c where tc9_et__Interpretation_Rule__c = '"+$jb.sfdc.interpretationRuleId+"'
and RecordType.Name='"+"Interpretation Variation Rule"+"'"

3. interpretationRuleBreakpointLeaveHeader

"SELECT CreatedById, CreatedDate, Id, Name, RecordType.Name,
tc9_et__Additional_Interpretation_BP_Details__c, tc9_et__Allowance_Type__c,
tc9_et__Breakpoint_Type__c,
tc9_et__Casual_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Daily_Pay_Code_Cap_Record__r."+$externalFieldName+",
tc9_et__Daily_Pay_Code_Cap_Value__c, tc9_et__Daily_Quantity__c,
tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c, tc9_et__End_Threshold__c,
tc9_et__End_Time__c,
tc9_et__Frequency_Pay_Code_Cap_Record__r."+$externalFieldName+", tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c, tc9_et__Interpretation_Rule__c, tc9_et__Interpretation_Rule_Builder__c, tc9_et__Interpretation_Rule_Record_Type__c, tc9_et__Interpretation_Variation_Rule__c, tc9_et__Leave_Header__r."+$externalFieldName+",
tc9_et__Leave_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Leave_Rule__r."+$externalFieldName+",
tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
tc9_et__Overtime_Breakpoint__c,
tc9_et__Overtime_Pay_Code__r."+$externalFieldName+", tc9_et__Pay_Code__c, tc9_et__Pay_Code__r."+$externalFieldName+",tc9_et__Pay_Code__r.Id,
tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
tc9_et__Penalty_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Primary_Interpretation_Breakpoint__c, tc9_et__Public_Holiday_Pay_Code__r."+$externalFieldName+",
tc9_et__Reset_After_Payment__c,
tc9_et__Saturday_Pay_Code__r."+$externalFieldName+", tc9_et__Secondary_Interpretation_Breakpoint__c, tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c, tc9_et__Sunday_Pay_Code__r."+$externalFieldName+",
tc9_et__Variation_Type__c,"+$externalFieldName+" FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = '"+$jb.sfdc.interpretationRuleId+"'
and recordType.Name='Leave Breakpoint' and tc9_et__Breakpoint_Type__c = 'Leave
Header'";

4. interpretationRuleBreakpointPayCodeCap

"SELECT CreatedById, CreatedDate, Id, Name, RecordType.Name,
tc9_et__Additional_Interpretation_BP_Details__c, tc9_et__Allowance_Type__c,
tc9_et__Breakpoint_Type__c,
tc9_et__Casual_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Daily_Pay_Code_Cap_Record__r."+$externalFieldName+",
tc9_et__Daily_Pay_Code_Cap_Value__c, tc9_et__Daily_Quantity__c,
tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c, tc9_et__End_Threshold__c,
tc9_et__End_Time__c,
tc9_et__Frequency_Pay_Code_Cap_Record__r."+$externalFieldName+", tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c, tc9_et__Interpretation_Rule__c, tc9_et__Interpretation_Rule_Builder__c, tc9_et__Interpretation_Rule_Record_Type__c, tc9_et__Interpretation_Variation_Rule__c, tc9_et__Leave_Header__r."+$externalFieldName+",
tc9_et__Leave_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Leave_Rule__r."+$externalFieldName+",
tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
tc9_et__Overtime_Breakpoint__c,
tc9_et__Overtime_Pay_Code__r."+$externalFieldName+", tc9_et__Pay_Code__c, tc9_et__Pay_Code__r."+$externalFieldName+",tc9_et__Pay_Code__r.Id,
tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
tc9_et__Penalty_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Primary_Interpretation_Breakpoint__c, tc9_et__Public_Holiday_Pay_Code__r."+$externalFieldName+",
tc9_et__Reset_After_Payment__c,
tc9_et__Saturday_Pay_Code__r."+$externalFieldName+", tc9_et__Secondary_Interpretation_Breakpoint__c, tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c, tc9_et__Sunday_Pay_Code__r."+$externalFieldName+",
tc9_et__Variation_Type__c,"+$externalFieldName+" FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = '"+$jb.sfdc.interpretationRuleId+"'
and (recordType.Name='Pay Code Cap' or recordType.Name='Leave Breakpoint') and
tc9_et__Breakpoint_Type__c != 'Leave Header'"

5. interpretationRuleBreakpointOther

"SELECT CreatedById, CreatedDate, Id, Name, RecordType.Name,
tc9_et__Additional_Interpretation_BP_Details__c, tc9_et__Allowance_Type__c,
tc9_et__Breakpoint_Type__c,
tc9_et__Casual_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Daily_Pay_Code_Cap_Record__r."+$externalFieldName+",
tc9_et__Daily_Pay_Code_Cap_Value__c, tc9_et__Daily_Quantity__c,
tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c, tc9_et__End_Threshold__c,
tc9_et__End_Time__c,
tc9_et__Frequency_Pay_Code_Cap_Record__r."+$externalFieldName+", tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c, tc9_et__Interpretation_Rule__c, tc9_et__Interpretation_Rule_Builder__c, tc9_et__Interpretation_Rule_Record_Type__c, tc9_et__Interpretation_Variation_Rule__c, tc9_et__Leave_Header__r."+$externalFieldName+",
tc9_et__Leave_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Leave_Rule__r."+$externalFieldName+",
tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
tc9_et__Overtime_Breakpoint__c,
tc9_et__Overtime_Pay_Code__r."+$externalFieldName+", tc9_et__Pay_Code__c, tc9_et__Pay_Code__r."+$externalFieldName+",tc9_et__Pay_Code__r.Id,
tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
tc9_et__Penalty_Loading_Pay_Code__r."+$externalFieldName+", tc9_et__Primary_Interpretation_Breakpoint__c, tc9_et__Public_Holiday_Pay_Code__r."+$externalFieldName+",
tc9_et__Reset_After_Payment__c,
tc9_et__Saturday_Pay_Code__r."+$externalFieldName+", tc9_et__Secondary_Interpretation_Breakpoint__c, tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c, tc9_et__Sunday_Pay_Code__r."+$externalFieldName+",
tc9_et__Variation_Type__c,"+$externalFieldName+" FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = '"+$jb.sfdc.interpretationRuleId+"'
and recordType.Name != 'Pay Code Cap' and recordType.Name != 'Leave Breakpoint'"
