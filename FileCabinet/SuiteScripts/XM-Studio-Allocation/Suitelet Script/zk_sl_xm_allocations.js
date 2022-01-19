/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/render', 'N/file', 'N/search', 'N/ui/serverWidget', 'N/task', 'N/runtime', 'N/https', 'N/format', "../Library/js/handlebars-v4.7.7", "N/url", "../Library/zk_xm_library", '../Library/js/moment'],
    function (record, render, file, search, serverWidget, task, runtime, https, format, handlebar, url, libHelper, moment) {
        var userObj = runtime.getCurrentUser();
        var stDatePreference = userObj.getPreference({name: "dateformat"});

        function onRequest(context) {
            if (context.request.method === 'GET') {
                switch (context.request.parameters.custpage_action) {
                    case "updatebonus":
                        break;
                    case "generatecsv":
                        break;
                    default:
                        buildMainPage(context);
                        break;
                }

            } else {
                /** POST **/
                switch (context.request.parameters.custpage_post) {
                    case "submitViewProduct":
                        buildMainPage(context);
                        break;
                    case "submitDistributorPool":
                        submitDistributorPool(context);
                        buildMainPage(context);
                        break;
                    case "submitAllocationOrder":
                        submitAllocationOrder(context);
                        buildMainPage(context);
                        break;
                    default:
                        buildMainPage(context);
                        break;
                }
            }
        }

        function buildMainPage(context) {
            var form = serverWidget.createForm({title: ' '});
            var stAllocationOrderLink = "";
            var txtProduct = (typeof context.request.parameters.txtProduct != 'undefined') ? context.request.parameters.txtProduct : "";
            var txtBrand = (typeof context.request.parameters.txtBrand != 'undefined') ? context.request.parameters.txtBrand : "";
            var txtCategory = (typeof context.request.parameters.txtCategory != 'undefined') ? context.request.parameters.txtCategory : "";
            var html = file.load({id: '../Library/mainpage.html'}).getContents();
            var template = handlebar.compile(html);
            var objItems = libHelper.getItems();
            var objInventoryDetails = libHelper.getItemInventoryDetails(txtProduct, txtBrand, txtCategory);
            var objProductAllocations = libHelper.getProductAllocations(txtProduct, txtBrand, txtCategory);
            var intEstimatedQuantity = (txtProduct) ? objItems[txtProduct].estimatedquantity : 0;
            var flDepositAmount = (txtProduct) ? objItems[txtProduct].depositamount : 0;
            var intAvailableManufactureQuantity = (txtProduct) ? objItems[txtProduct].availablemanufacturequantity : 0;
            var flRemainder = calculateRemainder(intAvailableManufactureQuantity, objProductAllocations);
            var objDefaultValues = {
                stProduct: txtProduct,
                stBrand: txtBrand,
                stCategory: txtCategory,
                stES: (txtProduct) ? objItems[txtProduct].es:0,
                stRemainder: flRemainder,
                stSample: (txtProduct) ? objItems[txtProduct].sample:0,
                intEstimatedQuantity: intEstimatedQuantity,
                flDepositAmount: flDepositAmount,
                intAvailableManufactureQuantity: intAvailableManufactureQuantity,
                stPrice: (txtProduct) ? objItems[txtProduct].baseprice : 0,
                stRetailPrice: (txtProduct) ? objItems[txtProduct].baseprice : 0,
                stMemberPrice: (txtProduct) ? objItems[txtProduct].baseprice : 0,
                stDistributorPool: (txtProduct) ? objItems[txtProduct].distributorpool:0,
                stItemType: (txtProduct) ? objItems[txtProduct].itemtype : "",
                stProductSeries: (txtProduct) ? objItems[txtProduct].productseries : "",
            };

            var objHandleBar = {
                objItems: objItems,
                objLocation: libHelper.getLocations(),
                objItemInventoryDetails: objInventoryDetails,
                stItemIventoryDetails: JSON.stringify(objInventoryDetails),
                stItems: JSON.stringify(objItems),
                stDefaultValues: JSON.stringify(objDefaultValues),
                objBrands: libHelper.getBrands(),
                objCategories: libHelper.getCategories(),
                objCustomers: libHelper.getCustomers(),
                objProductAllocations: objProductAllocations,
                stProductAllocations: JSON.stringify(objProductAllocations)
            };

            var htmlContent = template(objHandleBar);
            var objFld = form.addField({
                id: 'custpage_submenu',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'MENU',
            });
            objFld.defaultValue = htmlContent;
            context.response.writePage(form);
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

        function submitAllocationOrder(context) {
            var stDistributor = (typeof context.request.parameters.txtCreateAllocationDistributor != 'undefined') ? context.request.parameters.txtCreateAllocationDistributor : "";
            var stItem = (typeof context.request.parameters.txtCreateAllocationProduct != 'undefined') ? context.request.parameters.txtCreateAllocationProduct : "";
            var stQty = (typeof context.request.parameters.txtCreateAllocationQuantity != 'undefined') ? context.request.parameters.txtCreateAllocationQuantity : "";
            var stLocation = (typeof context.request.parameters.txtCreateAllocationLocation != 'undefined') ? context.request.parameters.txtCreateAllocationLocation : "";
            var stNotes = (typeof context.request.parameters.txtCreateAllocationNotes != 'undefined') ? context.request.parameters.txtCreateAllocationNotes : "";
            var stPreorderDate = (context.request.parameters.txtCreateAllocationPreorderDate) ? format.parse({
                value: moment(context.request.parameters.txtCreateAllocationPreorderDate).format(stDatePreference),
                type: format.Type.DATE
            }) : "";
            var stFirstOrderDeadline = (context.request.parameters.txtCreateAllocationFirstOrderDeadline) ? format.parse({
                value: moment(context.request.parameters.txtCreateAllocationFirstOrderDeadline).format(stDatePreference),
                type: format.Type.DATE
            }) : "";

            var recProductAllocation = record.create({type: "customrecord_zk_product_allocation", isDynamic: true});
            recProductAllocation.setValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.DISTRIBUTOR,
                value: stDistributor
            });
            recProductAllocation.setValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ITEM, value: stItem});
            recProductAllocation.setValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS, value: stQty});
            recProductAllocation.setValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY, value: stQty});
            recProductAllocation.setValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.LOCATION, value: stLocation});
            recProductAllocation.setValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.NOTES, value: stNotes});
            recProductAllocation.setValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.PREORDER_DATE,
                value: stPreorderDate
            });
            recProductAllocation.setValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.FIRSTORDER_DEADLINE,
                value: stFirstOrderDeadline
            });
            recProductAllocation.save();

            context.response.sendRedirect({
                type: https.RedirectType.SUITELET,
                identifier: 'customscript_zk_sl_xm_allocations',
                id: 'customdeploy_zk_sl_xm_allocations',
                parameters: {
                    txtProduct: stItem
                }
            });
        }

        function submitDistributorPool(context) {
            var txtProduct = (typeof context.request.parameters.txtProduct != 'undefined') ? context.request.parameters.txtProduct : "";
            var txtDistributorPool = (typeof context.request.parameters.txtEditDistributorPool != 'undefined') ? context.request.parameters.txtEditDistributorPool : "";

            if (!txtProduct) {
                return;
            }
            record.submitFields({
                type: record.Type.SERIALIZED_INVENTORY_ITEM,
                id: txtProduct,
                values: {
                    'custitem_zk_distributor_pool': txtDistributorPool
                }
            })
        }

        return {onRequest: onRequest};

    });