/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_cs_xm_pa_validation
Name                : ZK CS XM Product Allocation
Purpose             : Product Allocation Validations
Created On          : October 5,2021
Author              : Ceana Technology
Script Type         : Client Script
Saved Searches      : NONE
*/

define(['N/search'], function(search) {
    var flCurrentAllocatedQty = "";
    var objProductAllocations = {};
    var objInventoryDetails = {};

    function pageInit(context) {
        var currentRecord = context.currentRecord;
        flCurrentAllocatedQty = parseFloat(currentRecord.getValue("custrecord_zk_pa_allocated_quantity"));
        objProductAllocations = getProductAllocations(currentRecord);
        objInventoryDetails = getItemInventoryDetails(currentRecord);
    }

    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        if(context.fieldId == "custrecord_zk_pa_allocated_quantity") {
            // if(currentRecord.getValue("custrecord_zk_pa_salesorder")) {
            var flAllocatedQty = parseFloat(currentRecord.getValue("custrecord_zk_pa_allocated_quantity"));

            if(currentRecord.getValue("custrecord_zk_pa_status") == 1 && flAllocatedQty < flCurrentAllocatedQty) {
                alert("Cannot update the quantity lesser than the acknowledged quantity.");
                currentRecord.setValue("custrecord_zk_pa_allocated_quantity", flCurrentAllocatedQty);
            }

            if(flCurrentAllocatedQty != flAllocatedQty) {
                var flAdditionalQty = flAllocatedQty - flCurrentAllocatedQty;
                var flTotalPendingProductAllocation=0;
                var flTotalAvailableQuantiity=0;

                if(flAdditionalQty>0) {
                    var lookupFieldItem = search.lookupFields({
                        type: search.Type.ITEM,
                        id: currentRecord.getValue("custrecord_zk_pa_item"),
                        columns: ['custitem_zk_available_manufacture_qty']
                    });

                    flTotalAvailableQuantiity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;

                    for(var intIndex in objProductAllocations) {
                        if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending") {
                            flTotalPendingProductAllocation += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                        }
                    }

                    if(parseFloat(flTotalAvailableQuantiity - flTotalPendingProductAllocation) < flAdditionalQty) {
                        alert("Not Enough Available Quantity.");
                        currentRecord.setValue("custrecord_zk_pa_allocated_quantity", flCurrentAllocatedQty);
                    }
                }
            }
        }
    }

    function getProductAllocations(currentRecord) {
        var objData = {};
        var filters = [
            ["custrecord_zk_pa_item","is",currentRecord.getValue("custrecord_zk_pa_item")], "AND",
            // ["custrecord_zk_pa_location","is",currentRecord.getValue("custrecord_zk_pa_location")], "AND",
            ["custrecord_zk_pa_status","noneof",3]
        ];

        var itemSearchObj = search.create({
            type: "customrecord_zk_product_allocation",
            filters: filters,
            columns: [
                search.createColumn({ name: "custrecord_zk_pa_distributor" }),
                search.createColumn({ name: "custrecord_zk_pa_allocated_quantity" }),
                search.createColumn({ name: "custrecord_zk_pa_ordered_quantity" }),
                search.createColumn({ name: "custrecord_zk_pa_leftovers" }),
                search.createColumn({ name: "custrecord_zk_pa_waitlist" }),
                search.createColumn({ name: "custrecord_zk_pa_change" }),
                search.createColumn({ name: "custrecord_zk_pa_status" }),
                search.createColumn({ name: "custrecord_zk_pa_deposit" }),
                search.createColumn({ name: "custrecord_zk_pa_balance" }),
                search.createColumn({ name: "custrecord_zk_pa_notes" }),
                search.createColumn({ name: "custrecord_zk_pa_item" }),
                search.createColumn({ name: "lastmodified" }),
                search.createColumn({ name: "custrecord_zk_pa_location" })
            ]
        });
        var searchResultCount = itemSearchObj.runPaged().count;
        if(searchResultCount != 0) {
            itemSearchObj.run().each(function(result){
                if(objData[result.id] == null) { objData[result.id] = {}; }
                objData[result.id] = {
                    'recordid': result.id,
                    'lastmodified': result.getValue('lastmodified'),
                    'custrecord_zk_pa_distributor': result.getText('custrecord_zk_pa_distributor'),
                    'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                    'custrecord_zk_pa_ordered_quantity': result.getValue('custrecord_zk_pa_ordered_quantity') || 0,
                    'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers') || 0,
                    'custrecord_zk_pa_waitlist': result.getValue('custrecord_zk_pa_waitlist') || 0,
                    'custrecord_zk_pa_change': result.getValue('custrecord_zk_pa_change') || 0,
                    'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                    'isPending': (result.getText('custrecord_zk_pa_status') == 'Pending') ? true : false,
                    'isCancelled': (result.getText('custrecord_zk_pa_status') == 'Cancelled') ? true : false,
                    'custrecord_zk_pa_deposit': result.getValue('custrecord_zk_pa_deposit'),
                    'custrecord_zk_pa_balance': result.getValue('custrecord_zk_pa_balance'),
                    'custrecord_zk_pa_notes': result.getValue('custrecord_zk_pa_notes'),
                    'custrecord_zk_pa_item': result.getText('custrecord_zk_pa_item'),
                    'custrecord_zk_pa_location': result.getText('custrecord_zk_pa_location'),
                    'custrecord_zk_pa_locationid': result.getValue('custrecord_zk_pa_location')
                };
                return true;
            });
        }
        return objData;
    }

    function getItemInventoryDetails(currentRecord) {
        var objData = {};
        var filters = [
            ["isinactive","is","F"], "AND",
            ["internalid","is",currentRecord.getValue("custrecord_zk_pa_item")], "AND",
            ["inventorylocation","is",currentRecord.getValue("custrecord_zk_pa_location")]
        ];


        var itemSearchObj = search.create({
            type: "item",
            filters: filters,
            columns: [
                search.createColumn({name: "locationquantityavailable", label: "Location Available"}),
                search.createColumn({name: "inventorylocation", label: "Inventory Location"})
            ]
        });
        var searchResultCount = itemSearchObj.runPaged().count;
        if(searchResultCount!=0) {
            itemSearchObj.run().each(function(result){
                if(objData[result.getValue({name:"inventorylocation"})] == null) { objData[result.getValue({name:"inventorylocation"})] = {}; }
                objData[result.getValue({name:"inventorylocation"})] = {
                    locationquantityavailable: result.getValue({name:"locationquantityavailable"}) || 0,
                    inventorylocation: result.getText({name:"inventorylocation"}),
                    inventorylocationid: result.getValue({name:"inventorylocation"})
                };
                return true;
            });
        }
        return objData;
    }

    return { fieldChanged: fieldChanged, pageInit:pageInit };
});