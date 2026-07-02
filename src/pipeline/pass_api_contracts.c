/*
 * pass_api_contracts.c — Extract and link API Contracts to Route nodes.
 *
 * This pass runs after pass_route_nodes. It:
 *   1. Iterates over all Route nodes.
 *   2. Finds the handler Function(s) connected via HANDLES edges.
 *   3. Extracts parameter names, types, and return types from the handler.
 *   4. Creates a Contract node with this schema info.
 *   5. Links Route → Contract via HAS_CONTRACT.
 */
#include "pipeline/pipeline_internal.h"
#include "foundation/log.h"
#include <yyjson/yyjson.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void cbm_pipeline_create_api_contracts(cbm_pipeline_ctx_t *ctx) {
    cbm_gbuf_t *gb = ctx->gbuf;
    const cbm_gbuf_node_t **routes = NULL;
    int route_count = 0;

    /* Find all Route nodes in the graph buffer */
    if (cbm_gbuf_find_by_label(gb, "Route", &routes, &route_count) != 0 || route_count == 0) {
        return;
    }

    int created = 0;
    for (int i = 0; i < route_count; i++) {
        const cbm_gbuf_node_t *route = routes[i];
        
        /* Find HANDLES edges targeting this Route (from Function -> Route) */
        const cbm_gbuf_edge_t **handles_edges = NULL;
        int handles_count = 0;
        cbm_gbuf_find_edges_by_target_type(gb, route->id, "HANDLES", &handles_edges, &handles_count);
        
        for (int j = 0; j < handles_count; j++) {
            const cbm_gbuf_node_t *handler = cbm_gbuf_find_by_id(gb, handles_edges[j]->source_id);
            if (!handler || !handler->properties_json) continue;

            /* Parse the handler's properties to get type info */
            yyjson_doc *doc = yyjson_read(handler->properties_json, strlen(handler->properties_json), 0);
            if (!doc) continue;

            yyjson_val *root = yyjson_doc_get_root(doc);
            yyjson_val *params = yyjson_obj_get(root, "param_names");
            yyjson_val *types = yyjson_obj_get(root, "param_types");
            yyjson_val *returns = yyjson_obj_get(root, "return_types");

            /* If no contract info is available, skip */
            if (!params && !returns) {
                yyjson_doc_free(doc);
                continue;
            }

            /* Build a new JSON object for the Contract node */
            yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(NULL);
            yyjson_mut_val *mut_root = yyjson_mut_obj(mut_doc);
            yyjson_mut_doc_set_root(mut_doc, mut_root);

            if (params) {
                yyjson_mut_obj_add(mut_root, yyjson_mut_strcpy(mut_doc, "inputs"), 
                                   yyjson_val_mut_copy(mut_doc, params));
            }
            if (types) {
                yyjson_mut_obj_add(mut_root, yyjson_mut_strcpy(mut_doc, "input_types"), 
                                   yyjson_val_mut_copy(mut_doc, types));
            }
            if (returns) {
                yyjson_mut_obj_add(mut_root, yyjson_mut_strcpy(mut_doc, "outputs"), 
                                   yyjson_val_mut_copy(mut_doc, returns));
            }

            char *contract_json = yyjson_mut_write(mut_doc, 0, NULL);
            
            /* Deterministic QN for the Contract node */
            char contract_qn[CBM_SZ_1K];
            snprintf(contract_qn, sizeof(contract_qn), "__contract__%s", 
                     route->qualified_name ? route->qualified_name : "unknown");
            
            /* Upsert the Contract node */
            int64_t contract_id = cbm_gbuf_upsert_node(gb, "Contract", 
                                                       route->name ? route->name : "API Contract", 
                                                       contract_qn, 
                                                       handler->file_path ? handler->file_path : "", 
                                                       handler->start_line, 
                                                       handler->end_line, 
                                                       contract_json);
            
            /* Link Route -> Contract */
            if (contract_id > 0) {
                cbm_gbuf_insert_edge(gb, route->id, contract_id, "HAS_CONTRACT", "{}");
                created++;
            }
            
            if (contract_json) free(contract_json);
            yyjson_mut_doc_free(mut_doc);
            yyjson_doc_free(doc);
        }
    }

    if (created > 0) {
        char buf[CBM_SZ_32];
        snprintf(buf, sizeof(buf), "%d", created);
        cbm_log_info("pass.api_contracts", "created", buf);
    }
}
