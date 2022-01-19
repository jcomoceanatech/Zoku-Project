/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

/*
ID        		    : zk_cs_xm_product_allocation
Name                : Production Allocation
Purpose             : Product Allocation add functionality
Created On          : September 21,2021
Author              : Ceana Technology
Script Type         : Client Script
Saved Searches      : NONE
*/

define(['N/currentRecord', 'N/record', 'N/ui/dialog', 'N/search', 'N/email', 'N/url', 'N/https'],
    function (currentRecord, record, dialog, search, email, url, https) {

        var currentRecordProductAllocation = currentRecord.get();
        var getProductAllocationId = currentRecordProductAllocation.getValue({fieldId: 'id'});
        var intItemId = currentRecordProductAllocation.getValue({fieldId: 'custrecord_zk_pa_item'});
        var flCurrentAllocatedQty = "";

        function createInventoryStatusChange() {

            loadRecordProductAllocation.setValue({
                fieldId: "custrecord_zk_pa_process_isc",
                value: true
            });
            loadRecordProductAllocation.save();

            function success(result) {
                if (result === true) {
                    window.location.reload(true);
                }
            }

            function failure(reason) {
                console.log('Failure: ' + reason)
            }

            dialog.alert({
                title: 'Success',
                message: 'Inventory Status Change Created!'
            }).then(success).catch(failure);

        }

        function changeToUnallocatedStatus() {

            var recordInventoryStatusChange = record.submitFields({
                type: 'inventorystatuschange',
                id: getInventoryStatusChangeId,
                values: {
                    previousstatus: '2',
                    revisedstatus: '3'
                }
            });

        }

        function changeAcknowledgeStatus() {
            try {
                var errorMessage = "";
                var fetchItemRate = 0;
                var objProductAllocation = getProductAllocationDetails(getProductAllocationId);
                if (!objProductAllocation.pricelevel) {
                    errorMessage += "No Price Level Setup under the Customer Record.\n";
                }

                if(objProductAllocation.pricelevel) {
                    fetchItemRate = getItemPrice(objProductAllocation);
                }

                if (!objProductAllocation.department && !objProductAllocation.class) {
                    errorMessage += "No data available for item department or class fields.\n";
                }
                // if(!objProductAllocation.pricinggroup) { errorMessage += "No Pricing Group Setup under the Item Record.\n"; }

                if (fetchItemRate == 0 || fetchItemRate == "") {
                    errorMessage += "No Price Setup for " + objProductAllocation.priceleveltext + ".\n";
                }
                if (!objProductAllocation.advanceitem) {
                    errorMessage += "No Advance Item Setup under the Item Record.\n";
                }

                if (errorMessage != "") {
                    alert(errorMessage);
                } else {
                    // changeToUnallocatedStatus();
                    var confirmSOCreate = true;
                    if (!objProductAllocation.category || !objProductAllocation.pricinggroup) {
                        confirmSOCreate = confirm("No Category or Pricing Group Setup for Customer Discount. Are you sure you want to continue?");
                    }

                    if (confirmSOCreate) {
                        window.document.getElementById('custpage_acknowledge').disabled = true;
                        var recProductAllocation = record.load({
                            type: 'customrecord_zk_product_allocation',
                            id: getProductAllocationId
                        });
                        var inLeftovers=parseInt(recProductAllocation.getValue("custrecord_zk_pa_leftovers"));
                        var inOrderedQuantity=parseInt(recProductAllocation.getValue("custrecord_zk_pa_ordered_quantity") || 0);
                        recProductAllocation.setValue("custrecord_zk_pa_leftovers", 0);
                        recProductAllocation.setValue("custrecord_zk_pa_ordered_quantity", inLeftovers+inOrderedQuantity);
                        recProductAllocation.setValue("custrecord_zk_pa_allocated_quantity", inLeftovers+inOrderedQuantity);
                        recProductAllocation.setValue("custrecord_zk_pa_to_process_so", true);
                        recProductAllocation.save();

                        sendAcknowledgedNotification(objProductAllocation);

                        function success(result) {
                            if (result === true) {
                                window.location.reload(true);
                            }
                        }

                        function failure(reason) {
                            console.log('Failure: ' + reason)
                        }

                        dialog.alert({
                            title: 'Success',
                            message: 'Acknowledged!, Sales Order created'
                        }).then(success).catch(failure);
                    }

                }
            } catch (e) {
                alert(e);
                console.log(e);
            }
        }

        function createSalesOrder(objProductAllocation) {
            var intCustomerCategory = (objProductAllocation.category) ? objProductAllocation.category : "";
            var intPricingGroup = (objProductAllocation.pricinggroup) ? objProductAllocation.pricinggroup : "";
            var fetchItemRate = getItemPrice(objProductAllocation);
            var flDiscount = parseFloat(getCustomerDiscountPercent(intCustomerCategory, intPricingGroup));
            var flDiscountAmount = fetchItemRate * parseFloat(flDiscount / 100);
            var flDiscountedRate = fetchItemRate - flDiscountAmount;

            var createSalesOrder = record.create({
                type: 'salesorder',
                defaultValues: {entity: objProductAllocation.custrecord_zk_pa_distributor, subsidiary: 1}
            });

            createSalesOrder.setValue({fieldId: 'tobeemailed', value: false});
            createSalesOrder.setValue({fieldId: 'trandate', value: new Date()});
            createSalesOrder.setValue({fieldId: 'location', value: objProductAllocation.custrecord_zk_pa_location});
            createSalesOrder.setValue({fieldId: 'custbody_zk_so_product_allocation', value: getProductAllocationId});

            var currentLine = createSalesOrder.insertLine({sublistId: 'item', line: 0});
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: 0,
                value: objProductAllocation.custrecord_zk_pa_item
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'department',
                line: 0,
                value: objProductAllocation.department
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'class',
                line: 0,
                value: objProductAllocation.class
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'price',
                line: 0,
                value: objProductAllocation.pricelevel
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: 0,
                value: parseFloat(objProductAllocation.custrecord_zk_pa_allocated_quantity)
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_original_rate',
                line: 0,
                value: fetchItemRate
            });
            currentLine.setSublistValue({sublistId: 'item', fieldId: 'rate', line: 0, value: flDiscountedRate});
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_discount_percent',
                line: 0,
                value: flDiscount
            });
            currentLine.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_discount_amount',
                line: 0,
                value: flDiscountAmount
            });
            var idSalesOrder = createSalesOrder.save();

            if (idSalesOrder) {
                updateEstimatedManufacturedQuantity(objProductAllocation.custrecord_zk_pa_item, objProductAllocation.custrecord_zk_pa_allocated_quantity, "acknowledge");
            }

            return idSalesOrder;

        }

        function cancelProductAllocation() {
            function success(result) {
                if (result === true) {
                    var objProductAllocation = getProductAllocationDetails(getProductAllocationId);

                    record.submitFields({
                        type: 'customrecord_zk_product_allocation',
                        id: getProductAllocationId,
                        values: {custrecord_zk_pa_status: '3'}
                    });

                    /*if (objProductAllocation.custrecord_zk_pa_salesorder) {
                        record.delete({type: 'salesorder', id: objProductAllocation.custrecord_zk_pa_salesorder});
                    }*/
                    closeSalesOrder(getProductAllocationId);

                    // changeToUnallocatedStatus();
                    window.location.reload(true);
                }
            }

            function failure(reason) {
                console.log('Failure: ' + reason)
            }

            dialog.confirm({
                title: 'Alert',
                message: 'Are you sure you want to cancel this allocation order?'
            }).then(success).catch(failure);

        }

        function getCustomerDiscountPercent(intCustomerCategory, intPricingGroup) {
            var discountPercent = 0;

            if (!intCustomerCategory || !intPricingGroup) return discountPercent;

            var discountSearchObj = search.create({
                type: "customrecord_customer_discounting",
                filters: [
                    ["isinactive", "is", "F"], "AND",
                    ["custrecord_zk_cd_customer_category", "is", intCustomerCategory], "AND",
                    ["custrecord_zk_cd_pricing_grioup", "is", intPricingGroup]
                ],
                columns: [search.createColumn({name: "custrecord_zk_cd_discount_percent"})]
            });
            var searchResultCount = discountSearchObj.runPaged().count;
            if (searchResultCount != 0) {
                discountSearchObj.run().each(function (result) {
                    discountPercent = result.getValue({name: "custrecord_zk_cd_discount_percent"})
                    return true;
                });
            }
            return discountPercent;
        }

        function getItemPrice(objProductAllocation) {
            var flLineItemRate = 0;
            var arrData = [];
            var searchPricingObj = search.create({
                type: 'pricing',
                filters: [
                    ['item', search.Operator.IS, objProductAllocation.custrecord_zk_pa_item], 'and',
                    ['currency', search.Operator.IS, objProductAllocation.currency], 'and',
                    ['pricelevel', search.Operator.IS, objProductAllocation.pricelevel]
                ],
                columns: [
                    search.createColumn({name: "minimumquantity", sort: search.Sort.ASC}),
                    search.createColumn({name: "unitprice"}),
                    search.createColumn({name: "quantityrange"}),
                ]
            });

            var searchResultCount = searchPricingObj.runPaged().count;
            if (searchResultCount != 0) {
                var currentRange = searchPricingObj.run().getRange({start: 0, end: 5});
                for (var intIndex = 0; intIndex < currentRange.length; intIndex++) {
                    var arrQtyRange = currentRange[intIndex].getValue('quantityrange').split("-");
                    var intLimit = arrQtyRange[1];
                    if (arrQtyRange.length == 2) {
                        if (parseFloat(objProductAllocation.custrecord_zk_pa_allocated_quantity) <= parseFloat(intLimit)) {
                            flLineItemRate = currentRange[intIndex].getValue('unitprice');
                            console.log(objProductAllocation.custrecord_zk_pa_allocated_quantity + " <= " + intLimit + " ===== " + flLineItemRate);
                            break;
                        }
                    } else if (arrQtyRange.length == 1) {
                        flLineItemRate = currentRange[intIndex].getValue('unitprice');
                    }
                }
            }

            return flLineItemRate;
        }

        function redirectDashboard() {
            window.location.href = '/app/site/hosting/scriptlet.nl?script=421&deploy=1&compid=6961610&whence=';
        }

        function getProductAllocationDetails(intProductAllocation) {
            var objData = {};
            var customrecord_zk_product_allocationSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: ["internalid", "is", intProductAllocation],
                columns: [
                    search.createColumn({name: "name"}),
                    search.createColumn({name: "custrecord_zk_pa_distributor"}),
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_status"}),
                    search.createColumn({name: "custrecord_zk_pa_item"}),
                    search.createColumn({name: "custrecord_zk_pa_salesorder"}),
                    search.createColumn({name: "custrecord_zk_pa_location"}),
                    search.createColumn({name: "department", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "class", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "pricinggroup", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "custitem_zk_advance_item", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "currency", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                    search.createColumn({name: "pricelevel", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                    search.createColumn({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"})
                ]
            });
            var searchResultCount = customrecord_zk_product_allocationSearchObj.runPaged().count;
            if (searchResultCount.length != 0) {
                customrecord_zk_product_allocationSearchObj.run().each(function (result) {
                    objData = {
                        tranid: result.getValue({name: "name"}),
                        custrecord_zk_pa_distributor: result.getValue({name: "custrecord_zk_pa_distributor"}),
                        custrecord_zk_pa_allocated_quantity: result.getValue({name: "custrecord_zk_pa_allocated_quantity"}),
                        custrecord_zk_pa_status: result.getValue({name: "custrecord_zk_pa_status"}),
                        custrecord_zk_pa_item: result.getValue({name: "custrecord_zk_pa_item"}),
                        custrecord_zk_pa_item_text: result.getText({name: "custrecord_zk_pa_item"}),
                        custrecord_zk_pa_salesorder: result.getValue({name: "custrecord_zk_pa_salesorder"}),
                        custrecord_zk_pa_location: result.getValue({name: "custrecord_zk_pa_location"}),
                        advanceitem: result.getValue({name: "custitem_zk_advance_item", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        department: result.getValue({name: "department", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        class: result.getValue({name: "class", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        pricinggroup: result.getValue({name: "pricinggroup", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        currency: result.getValue({name: "currency", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        pricelevel: result.getValue({name: "pricelevel", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        priceleveltext: result.getText({name: "pricelevel", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        category: result.getValue({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"})
                    };
                    return false;
                });
            }
            return objData;
        }

        function sendAcknowledgedNotification(objProductAllocation) {
            var arrEmployees = getEmployees();
            if (arrEmployees.length != 0) {
                var body = "";
                body += '<div class="row">';
                body += '  <div class="col-md-12" style="text-align:center; padding-top: 20px;">';
                body += '  <p style="font-size: 15px;">Acknowledged Product Allocation:</p>';
                body += '  </div>';
                body += '  <div class="col-md-12" style="text-align:center; padding-top: 20px;">';
                body += '  <p style="font-size: 15px;">Allocation Number:' + objProductAllocation.tranid + '</p>';
                body += '  <p style="font-size: 15px;">Item:' + objProductAllocation.custrecord_zk_pa_item_text + '</p>';
                body += '  <p style="font-size: 15px;">Quantity:' + objProductAllocation.custrecord_zk_pa_allocated_quantity + '</p>';
                body += '  </div>';
                body += '  </div>';
                body += '  <br/>';
                email.sendBulk({
                    author: 5,
                    recipients: arrEmployees,
                    subject: 'Product Allocation has been Acknowledged',
                    body: body,
                });
            }
        }

        function getEmployees() {
            var arrData = [];
            var objSearchEmployees = search.load({id: "customsearch_zk_ss_xm_list_employees"});
            var searchEmployeesResultCount = objSearchEmployees.runPaged().count;
            if (searchEmployeesResultCount != 0) {
                objSearchEmployees.run().each(function (result) {
                    var employeeInternalID = result.getValue('internalid');
                    arrData.push(employeeInternalID);
                    return true;
                })
            }
            return arrData;
        }

        function updateEstimatedManufacturedQuantity(intItemId, flQuantity, executionType) {
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

            if (executionType == "acknowledge") {
                //Acknowledge
                flRemaningQuantity = parseFloat(flEstimatedQuantity) - parseFloat(flQuantity);
            } else {
                // Cancel/Delete Product Allocation
                flRemaningQuantity = parseFloat(flEstimatedQuantity) + parseFloat(flQuantity);
            }

            record.submitFields({
                type: stItemType,
                id: intItemId,
                values: {
                    custitem_zk_available_manufacture_qty: flRemaningQuantity
                }
            });
        }

        function showDialogBox(intItem) {
            try {
                var intAvailableManufactureQuantity = getItemAvailableQuantity(intItem);
                if(intAvailableManufactureQuantity>0) {
                    var options = dialogBody(intItem,intAvailableManufactureQuantity);

                    dialog.create(options)
                        .then(function (result) {
                            if (result) {
                                console.log('Input dialog closed with button ok');
                            } else {
                                console.log('Input dialog closed with button cancel');
                            }
                            // TODO: Trigger saving the form
                        })
                        .catch(function (reason) {
                            console.log('Failure: ' + reason);
                        });
                }else{
                    alert("Not Enough Available Quantity");
                }
            } catch (err) {
                log.error('ERROR: showDialogBox', err)
            }
        }

        function dialogBody(intItem,intAvailableManufactureQuantity) {
            var htmlMsg = getInputDialogTemplate(intItem,intAvailableManufactureQuantity);
            return {
                title: 'Enter additional quantity',
                message: htmlMsg,
                buttons: [
                    {
                        label: 'OK',
                        value: true
                    },
                    {
                        label: 'Cancel',
                        value: false
                    }
                ]
            };
        }

        function getInputDialogTemplate(intItem,intAvailableManufactureQuantity) {
            var objProductAllocations = getProductAllocations(intItem);
            console.log(1)
            var intRemainderQuantity = calculateRemainder(intAvailableManufactureQuantity, objProductAllocations)
            console.log(2)
            var htmlResponse = '';
            var output = url.resolveScript({
                scriptId: 'customscript_zk_sl_xm_add_allocation',
                deploymentId: 'customdeploy_zk_sl_xm_add_allocation',
                params: {
                    sltype: 'template',
                    remqty: intRemainderQuantity
                }
            });
            var response = https.get(output);
            if (response.code == 200) {
                htmlResponse = response.body;
            }
            return htmlResponse;
        }

        function getItemAvailableQuantity(intItem) {
            var lookupFieldItem = search.lookupFields({
                type: search.Type.ITEM,
                id: intItem,
                columns: ['custitem_zk_available_manufacture_qty']
            });
            return lookupFieldItem['custitem_zk_available_manufacture_qty'];
        }

        function calculateRemainder(intAvailableManufactureQuantity, objProductAllocations) {
            var flTotalAllocated = 0;
            for (var intIndex in objProductAllocations) {
                if (objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending") {
                    flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_leftovers || 0);
                }
            }

            return parseFloat(intAvailableManufactureQuantity - flTotalAllocated);
        }

        function getProductAllocations(intItem) {
            var objData = {};
            if (intItem == "") {
                return objData;
            }
            console.log('.1')
            var filters = [
                ["custrecord_zk_pa_item", "is", intItem], "AND",
                ["custrecord_zk_pa_status", "noneof", "3"]
            ];
            console.log('.1')
            var itemSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: filters,
                columns: [
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_status"}),
                    search.createColumn({name: "custrecord_zk_pa_leftovers"})
                ]
            });
            console.log('.2')
            var searchResultCount = itemSearchObj.runPaged().count;
            if (searchResultCount != 0) {
                itemSearchObj.run().each(function (result) {
                    if (objData[result.id] == null) {
                        objData[result.id] = {};
                    }
                    objData[result.id] = {
                        'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                        'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                        'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers')
                    };
                    return true;
                });
            }
            console.log('.3')
            return objData;
        }
        function closeSalesOrder(getProductAllocationId){
            if(checkSalesOrders(getProductAllocationId)) {
                var urlSL = url.resolveScript({
                    scriptId: 'customscript_zk_sl_xm_close_so_pa',
                    deploymentId: 'customdeploy_zk_sl_xm_close_so_pa',
                    returnExternalUrl: true
                });

                urlSL += '&processtype=' + 'clientscript';
                urlSL += '&id=' + getProductAllocationId;
                getSuiteletStatus(urlSL);
            }
        }
        function getSuiteletStatus(url) {
            try {
                var request = new XMLHttpRequest();
                request.open('GET', url);
                request.send();
            } catch (err) {
                log.error('getSuiteletStatus', err);
            }
        }
        function checkSalesOrders(getProductAllocationId){
            var srSalesOrder = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["custbody_zk_so_product_allocation","anyof",getProductAllocationId],
                        "AND",
                        ["mainline","is","T"]
                    ]
            });
            var inSOCount = srSalesOrder.runPaged().count;
            log.debug(getProductAllocationId+":result count",inSOCount);
            return inSOCount>0;
        }


        return {
            showDialogBox: showDialogBox,
            createInventoryStatusChange: createInventoryStatusChange,
            changeAcknowledgeStatus: changeAcknowledgeStatus,
            cancelProductAllocation: cancelProductAllocation,
            redirectDashboard: redirectDashboard
        };
    });
