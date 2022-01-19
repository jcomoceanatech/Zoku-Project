/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/file', 'N/record', 'N/search', "../Library/zk_xm_library"],
    function (serverWidget, file, record, search, libhelper) {

        function onRequest(context) {
            try {
                if (context.request.parameters.sltype == 'template') {
                    var stHtml = getTemplate(context.request.parameters.remqty);
                    log.debug('html', stHtml);
                    context.response.write(stHtml);

                } else {
                    log.debug('context', context);
                    updateLeftovers(context, context.request.parameters.remqty);
                }
            } catch (e) {
                log.error('error	:', e);
            }

        }

        function getTemplate(inRemainderQty) {
            var stHtml = '<table><tr><td><div>';
            stHtml += '<p>Additional Quantity: <input id="custpage_inputdialog" rows="5" cols="40" style="text-align:right" placeholder="Enter the number here..."></input></p>'
            stHtml += '</div></td><td><div>';
            stHtml += '<p>Remaining: <input id="custpage_remainder" rows="5" cols="40" style="text-align:right" value="' + inRemainderQty + '"></input></p>';
            stHtml += '</div></td></tr></table><table><tr><td>';
            stHtml += '<div class="uir-message-buttons"><button value="shadow-1" onclick="submitOK(true)">Ok</button></div></td>';
            stHtml += '<td><div class="uir-message-buttons"><button value="shadow-2" onclick="submitCancel(false)">Cancel</button></div></td></tr></table>';
            stHtml += '<script>jQuery(document).ready(function(){var fldRemainder=jQuery("#custpage_remainder");';
            stHtml += 'fldRemainder.prop( "disabled", true );';
            stHtml += 'jQuery("#custpage_inputdialog").keyup(function(){jQuery(this).val(jQuery(this).val().match(/\\d*\\.?\\d+/));';
            stHtml += 'if(parseInt(jQuery(this).val()) > ' + parseInt(inRemainderQty) + '){alert("Not Enough Available Quantity");jQuery(this).val("'+inRemainderQty+'");}';
            stHtml += 'else if (parseInt(jQuery(this).val()) < 1) {alert(\'Value cannot be lower than 1\');jQuery(this).val(\'\');}';
            stHtml += '});});';
            stHtml += 'function submitOK(id) {try {';
            stHtml += 'var stAdditionalQuantity = jQuery("#custpage_inputdialog").val();';
            stHtml += 'if(stAdditionalQuantity) {';
            stHtml += ' window.require(["N/url","N/https"],function (url,https) {';
            stHtml += 'var inType = window.nlapiGetRecordType();';
            stHtml += 'var inId = window.nlapiGetRecordId();';
            stHtml += 'var output = url.resolveScript({';
            stHtml += 'scriptId: "customscript_zk_sl_xm_add_allocation",';
            stHtml += 'deploymentId: "customdeploy_zk_sl_xm_add_allocation",';
            stHtml += ' params : {sltype : "process",rec_id : inId,rec_type : inType,additional : stAdditionalQuantity}});';
            stHtml += 'var response =  https.get(output);';
            stHtml += 'console.log("response",response);';
            stHtml += 'if(response.code === 200){window.location.reload();}});';
            stHtml += '}else{ alert("Value cannot be empty.") }';
            stHtml += '} catch (e) {console.log(e);}jQuery(`:button[value="${id}"]`).click();}';
            stHtml += 'function submitCancel(id) {jQuery(`:button[value="${id}"]`).click();}';
            stHtml += "(function ($) {$(function ($, undefined) {$('.uir-message-buttons').last().hide();})})(jQuery);</script>";

            return stHtml;

            /*file.load({
                id: 'SuiteScripts/XM Studios Allocation/Library/zk_additional_quantity_dialog.html'
            }).getContents();*/
        }

        function updateLeftovers(context, inRemainderQty) {

            var requestContext = context.request;
            var inRec = requestContext.parameters['rec_id'];
            var inRecType = requestContext.parameters['rec_type'];
            var stAdditionalQuantity = requestContext.parameters['additional'];
            log.debug(stAdditionalQuantity);

            if (inRec) {
                var srAllocRecord = search.lookupFields({
                    type: inRecType,
                    id: inRec,
                    columns: [libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS,libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]
                });
                var objValues = {};
                if (stAdditionalQuantity > 0) {
                    objValues[libhelper.PRODUCT_ALLOCATION_RECORD.STATUS] = libhelper.allocationStatus.PENDING
                }

                srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] != '' ? srAllocRecord['custrecord_zk_pa_leftovers'] : 0;

                stAdditionalQuantity = parseInt(stAdditionalQuantity) + parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS])

                objValues[libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS] = stAdditionalQuantity;//libhelper.PRODUCT_ALLOCATION_RECORD.LEFTOVERS
                objValues[libhelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY] = stAdditionalQuantity+parseInt(srAllocRecord[libhelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY]);

                var inRecord = record.submitFields({
                    type: inRecType,
                    id: inRec,
                    values: objValues
                });
            }
        }


        return {onRequest: onRequest};
    });