/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_ue_xm_product_allocation
Name                : Production Allocation
Purpose             : Product Allocation add functionality
Created On          : September 21,2021
Author              : Ceana Technology
Script Type         : User Event Script
Saved Searches      : NONE
*/

define(['N/ui/serverWidget', '../Library/zk_xm_library', 'N/search', 'N/record'], function (serverWidget, libHelper, search, record) {

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const STATUS_CANCELLED = "Cancelled";
    const STATUS_CLOSED = "Closed";

    function afterSubmit(scriptContext) {
        log.debug('scriptContext.type ', scriptContext.type);
        if (scriptContext.type == "create") {
            return;
        }

        var oldRecord = scriptContext.oldRecord;
        var newRecord = scriptContext.newRecord;
        log.debug(oldRecord.getValue("status"), newRecord.getValue("status"));
        if (scriptContext.type == "delete" && oldRecord.getValue("custbody_zk_so_product_allocation")) {

            if (oldRecord.getValue("status") != STATUS_CANCELLED && oldRecord.getValue("status") != STATUS_CLOSED) {
                updateEstimatedManufacturedQuantityCancelled(scriptContext);

            }
        } else {
            if ((newRecord.getValue("status") == 'C' || newRecord.getValue("status") == STATUS_CLOSED)
                && oldRecord.getValue("custbody_zk_so_product_allocation")) {

                updateEstimatedManufacturedQuantityCancelled(scriptContext);
            }
        }
    }

    function beforeSubmit(context) {
        log.debug('beforeSubmit.type ', context.type);
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;
        log.debug(oldRecord.getValue("status"), newRecord.getValue("status"));
        var intProductAllocationId = newRecord.getValue("custbody_zk_so_product_allocation");

        if (intProductAllocationId) {
            var flNewQuantity = newRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
            var flOldQuantity = oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
            var flNewRate = newRecord.getSublistValue({sublistId: "item", fieldId: "rate", line: 1});
            var flNewOriginalRate = newRecord.getSublistValue({
                sublistId: "item",
                fieldId: "custcol_original_rate",
                line: 1
            });
            if (flOldQuantity != flNewQuantity) {
                var lookupFieldItem = search.lookupFields({
                    type: search.Type.ITEM,
                    id: newRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 1}),
                    columns: ['custitem_zk_deposit_amount']
                });
                var flDepositAmount = (lookupFieldItem.custitem_zk_deposit_amount) ? lookupFieldItem.custitem_zk_deposit_amount : 0;
                var flAdvanceDepositRate = (flNewRate < flDepositAmount) ? flNewRate : flDepositAmount;
                var flNewAmount = flAdvanceDepositRate * flNewQuantity;

                newRecord.setSublistValue({sublistId: 'item', fieldId: 'quantity', line: 0, value: flNewQuantity});
                newRecord.setSublistValue({sublistId: 'item', fieldId: 'rate', line: 0, value: flAdvanceDepositRate});
                newRecord.setSublistValue({sublistId: 'item', fieldId: 'amount', line: 0, value: flNewAmount});
                newRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_rate',
                    line: 0,
                    value: flAdvanceDepositRate
                });

                newRecord.setSublistValue({sublistId: 'item', fieldId: 'quantity', line: 2, value: flNewQuantity});
                newRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: 2,
                    value: flAdvanceDepositRate * -1
                });
                newRecord.setSublistValue({sublistId: 'item', fieldId: 'amount', line: 2, value: flNewAmount * -1});
                newRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_rate',
                    line: 2,
                    value: flAdvanceDepositRate * -1
                });

                var lookupFieldProductAllocation = search.lookupFields({
                    type: 'customrecord_zk_product_allocation',
                    id: intProductAllocationId,
                    columns: ['custrecord_zk_pa_allocated_quantity']
                });
                var flExcessQuantity = parseFloat(flNewQuantity) - parseFloat(flOldQuantity);

                record.submitFields({
                    type: 'customrecord_zk_product_allocation',
                    id: intProductAllocationId,
                    values: {'custrecord_zk_pa_allocated_quantity': parseFloat(lookupFieldProductAllocation.custrecord_zk_pa_allocated_quantity) + parseFloat(flExcessQuantity)}
                });
                updateEstimatedManufacturedQuantity(context);
            }
        }
    }

    function form_button(fetchContext) {
        var currentForm = fetchContext.form;
        var currentRecord = fetchContext.newRecord;
        var stSoStatus = currentRecord.getValue({
            fieldId: 'status'
        });

        var intProductAllocId = currentRecord.id;
        log.debug(intProductAllocId,stSoStatus)
        if (fetchContext.type === fetchContext.UserEventType.VIEW) {
            if(stSoStatus=='Pending Fulfillment') {
                currentForm.removeButton('closeremaining');
                currentForm.addButton({
                    id: 'custpage_closeremaining_custom',
                    label: 'Close Order',
                    functionName: 'closeSalesOrder'
                });
            }
        }
        currentForm.clientScriptModulePath = '../Client Script/zk_cs_xm_so.js';
    }

    function beforeLoad(scriptContext) {
        try {
        if (scriptContext.type == "create") {
            return;
        }
            form_button(scriptContext);
        } catch (err) {
            log.debug(err);
        }
    }


    function updateEstimatedManufacturedQuantityCancelled(context) {
        var oldRecord = context.oldRecord;
        var intItemId = oldRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 1});
        var flNewAllocationQuantity = oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
        var arrItemTypes = {
            "Description": "descriptionitem",
            "Discount": "discountitem",
            "InvtPart": "inventoryitem",
            "Kit": "kititem",
            "Markup": "markupitem",
            "NonInvtPart": "noninventoryitem",
            "OthCharge": "otherchargeitem",
            "Payment": "paymentitem",
            "Service": "serviceitem"
        };
        var lookupFieldItem = search.lookupFields({
            type: search.Type.ITEM,
            id: intItemId,
            columns: ['custitem_zk_available_manufacture_qty', 'type', 'isserialitem', 'islotitem']
        });
        var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
        if (lookupFieldItem.isserialitem) {
            stItemType = "serializedinventoryitem";
        }
        if (lookupFieldItem.islotitem) {
            stItemType = "lotnumberedinventoryitem";
        }

        var flRemaningQuantity = 0;
        var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;
        flRemaningQuantity = parseFloat(flEstimatedQuantity) + flNewAllocationQuantity;

        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
        });
        var intProductAllocId = oldRecord.getValue("custbody_zk_so_product_allocation")
        if (checkRemainingSOs(intProductAllocId)) {
            var srProductAllocation = search.lookupFields({
                type: 'customrecord_zk_product_allocation',
                id: intProductAllocId,
                columns: [libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY, libHelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]
            });
            var objRemainingQty = {};

            objRemainingQty[libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY] =
                srProductAllocation[libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY] - flNewAllocationQuantity;

            objRemainingQty[libHelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY] =
                srProductAllocation[libHelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY] - flNewAllocationQuantity;

            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: intProductAllocId,
                values: objRemainingQty
            });
        } else {
            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: intProductAllocId,
                values: {custrecord_zk_pa_status: '3'}
            });
        }
    }

    function checkRemainingSOs(intProductAlloc) {
        var srSalesOrder = search.create({
            type: "salesorder",
            filters:
                [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["custbody_zk_so_product_allocation", "anyof", intProductAlloc],
                    "AND",
                    ["status", "noneof", "SalesOrd:C", "SalesOrd:H"],
                    "AND",
                    ["mainline", "is", "T"]
                ]
        });
        var inSOCount = srSalesOrder.runPaged().count;
        log.debug(intProductAlloc + ":result count", inSOCount);
        return inSOCount > 0;
    }

    function updateEstimatedManufacturedQuantity(context) {
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;
        var flOldAllocationQuantity = oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
        var intItemId = newRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 1});
        var flNewAllocationQuantity = newRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
        var arrItemTypes = {
            "Description": "descriptionitem",
            "Discount": "discountitem",
            "InvtPart": "inventoryitem",
            "Kit": "kititem",
            "Markup": "markupitem",
            "NonInvtPart": "noninventoryitem",
            "OthCharge": "otherchargeitem",
            "Payment": "paymentitem",
            "Service": "serviceitem"
        };
        var lookupFieldItem = search.lookupFields({
            type: search.Type.ITEM,
            id: intItemId,
            columns: ['custitem_zk_available_manufacture_qty', 'type', 'isserialitem', 'islotitem']
        });
        var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
        if (lookupFieldItem.isserialitem) {
            stItemType = "serializedinventoryitem";
        }
        if (lookupFieldItem.islotitem) {
            stItemType = "lotnumberedinventoryitem";
        }

        var flRemaningQuantity = 0;
        var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;

        if (flNewAllocationQuantity > flOldAllocationQuantity) {
            var flExcessQuantity = parseFloat(flNewAllocationQuantity) - parseFloat(flOldAllocationQuantity);
            flRemaningQuantity = parseFloat(flEstimatedQuantity) - flExcessQuantity;
        } else {
            var flToBeReturnedQuantity = parseFloat(flOldAllocationQuantity) - parseFloat(flNewAllocationQuantity);
            flRemaningQuantity = parseFloat(flEstimatedQuantity) + flToBeReturnedQuantity;
        }


        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
        });
    }

    return {beforeSubmit: beforeSubmit, afterSubmit: afterSubmit,beforeLoad:beforeLoad}

});