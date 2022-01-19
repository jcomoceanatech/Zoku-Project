/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/*
ID        		    : customscript_zk_mr_xm_close_so
Name                : ZK MR XM Close Sales Order
Purpose             : Close Sales Order
Created On          : Dec 29,2021
Author              : Ceana Technology
Script Type         : Map Reduce Script
Saved Searches      : NONE
*/
define(['N/record', 'N/search', 'N/runtime'],

    (record, search, runtime) => {

        var currScript = runtime.getCurrentScript();
        const getInputData = (inputContext) => {
            try {
                var intProductAllocId = JSON.parse(currScript.getParameter('custscript_zk_xm_pa_id'));
                log.debug(intProductAllocId);
                var arrSOIds = [];
                var srSalesOrder = search.create({
                    type: search.Type.SALES_ORDER,
                    filters:
                        [
                            ["custbody_zk_so_product_allocation", "anyof", intProductAllocId],
                            "AND",
                            ["mainline", "is", "T"]
                        ]
                });
                srSalesOrder.run().each(function (result) {

                    arrSOIds.push(result.id);
                    return true;
                });
                log.debug('arrSOIds', arrSOIds);
                return arrSOIds;
            } catch (error) {
                log.error('getInputStage-Error:', error);
            }

        }

        const map = (mapContext) => {
            try {
                var intSOId = JSON.parse(mapContext.value);
                var recSO = record.load({
                    type: record.Type.SALES_ORDER,
                    id: intSOId,
                    isDynamic: true
                });
                var intLineCount = recSO.getLineCount({
                    sublistId: 'item'
                });

                log.debug('intLineCount',intLineCount)
                for (var lineIndex=0; lineIndex<intLineCount;lineIndex++) {

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
            } catch (error) {
                log.error('map:error:',error)
            }
        }

        const reduce = (reduceContext) => {

        }

        const summarize = (summaryContext) => {

        }

        return {getInputData, map, reduce, summarize}

    });