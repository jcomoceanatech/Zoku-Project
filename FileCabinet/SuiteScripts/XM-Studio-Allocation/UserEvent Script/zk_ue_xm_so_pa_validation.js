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

define(['N/ui/serverWidget', '../Library/zk_xm_library','N/search','N/record'], function(serverWidget, libHelper,search,record) {

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */

    function afterSubmit(scriptContext) {
        var oldRecord = scriptContext.oldRecord;
        var newRecord = scriptContext.newRecord;

        if(scriptContext.type == "delete" && oldRecord.getValue("custbody_zk_so_product_allocation")) {
            updateEstimatedManufacturedQuantity(scriptContext);
        }

        if(newRecord.getValue("status") == "C" && oldRecord.getValue("custbody_zk_so_product_allocation")) {
            updateEstimatedManufacturedQuantity(scriptContext);
        }
    }

    function updateEstimatedManufacturedQuantity(context) {
        var oldRecord = context.oldRecord;
        var intItemId = oldRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 1});
        var flNewAllocationQuantity = oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 0});
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
            columns: ['custitem_zk_available_manufacture_qty','type','isserialitem','islotitem']
        });
        var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
        if(lookupFieldItem.isserialitem) { stItemType = "serializedinventoryitem"; }
        if(lookupFieldItem.islotitem) { stItemType = "lotnumberedinventoryitem"; }

        var flRemaningQuantity = 0;
        var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;
        flRemaningQuantity = parseFloat(flEstimatedQuantity) + flNewAllocationQuantity;

        log.debug("flEstimatedQuantity", flEstimatedQuantity);
        log.debug("flNewAllocationQuantity", flNewAllocationQuantity);
        log.debug("flRemaningQuantity", flRemaningQuantity);
        log.debug(stItemType, intItemId);

        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: { custitem_zk_available_manufacture_qty: flRemaningQuantity }
        });

        record.submitFields({
            type: 'customrecord_zk_product_allocation',
            id: oldRecord.getValue("custbody_zk_so_product_allocation"),
            values: { custrecord_zk_pa_status: '3' }
        });
    }

    return {
        afterSubmit: afterSubmit
    }

});