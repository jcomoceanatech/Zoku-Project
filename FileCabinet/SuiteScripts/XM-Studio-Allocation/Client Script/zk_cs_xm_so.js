/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search'],

    function (currentRecord, record, search) {
        var currentSoRecord = currentRecord.get();
        var getSoId = currentSoRecord.getValue({fieldId: 'id'});


        function closeSalesOrder() {

            var recSO = record.load({
                id: getSoId,
                type: record.Type.SALES_ORDER,
                isDynamic: true
            })

            var flAllocationQuantity = recSO.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
            var intItemId = recSO.getSublistValue({sublistId: "item", fieldId: "item", line: 1});
            var getPaId = recSO.getValue({fieldId: 'custbody_zk_so_product_allocation'});

            var intLineCount = recSO.getLineCount({
                sublistId: 'item'
            });
            for (var lineIndex = 0; lineIndex < intLineCount; lineIndex++) {

                var lineNum = recSO.selectLine({
                    sublistId: 'item',
                    line: lineIndex
                });
                recSO.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'isclosed',
                    value: true,
                    ignoreFieldChange: true
                });
                recSO.commitLine({
                    sublistId: 'item',
                    line: lineIndex
                });
            }
            recSO.save();
            updateProductAllocation(getPaId, flAllocationQuantity,intItemId);

            window.location.reload(true);
        }

        function updateProductAllocation(getPaId, flAllocationQuantity,intItemId) {
            console.log(getPaId, flAllocationQuantity)
            if (checkRemainingSOs(getPaId)) {
                var srProductAllocation = search.lookupFields({
                    type: 'customrecord_zk_product_allocation',
                    id: getPaId,
                    columns: ['custrecord_zk_pa_allocated_quantity', 'custrecord_zk_pa_ordered_quantity']
                });
                var objRemainingQty = {};

                objRemainingQty['custrecord_zk_pa_allocated_quantity'] =
                    srProductAllocation['custrecord_zk_pa_allocated_quantity'] - flAllocationQuantity;

                objRemainingQty['custrecord_zk_pa_ordered_quantity'] =
                    srProductAllocation['custrecord_zk_pa_ordered_quantity'] - flAllocationQuantity;
                console.log(objRemainingQty)
                record.submitFields({
                    type: 'customrecord_zk_product_allocation',
                    id: getPaId,
                    values: objRemainingQty
                });
                updateEstimatedManufacturedQuantityCancelled(intItemId,flAllocationQuantity);
            } else {
                record.submitFields({
                    type: 'customrecord_zk_product_allocation',
                    id: getPaId,
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
            return inSOCount > 0;
        }
        function updateEstimatedManufacturedQuantityCancelled(intItemId,flAllocationQuantity) {

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
            flRemaningQuantity = parseFloat(flEstimatedQuantity) + flAllocationQuantity;

            record.submitFields({
                type: stItemType,
                id: intItemId,
                values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
            });
        }

        return {
            closeSalesOrder: closeSalesOrder
        };

    });
