/*
 * pass_business_logic.c — Tag functions containing core business logic.
 *
 * Uses heuristics (complexity, naming patterns, file paths) to identify
 * functions that represent business rules or operational logic.
 *
 * For each identified function, it creates a 'BusinessRule' node and
 * links it from the Function -> BusinessRule via 'IMPLEMENTS_RULE'.
 */
#include "pipeline/pipeline_internal.h"
#include "foundation/log.h"
#include <yyjson/yyjson.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

/* Case-insensitive substring search */
static bool strcasestr_portable(const char *haystack, const char *needle) {
    if (!haystack || !needle) return false;
    size_t nl = strlen(needle);
    if (nl == 0) return true;
    for (; *haystack; haystack++) {
        if (tolower((unsigned char)*haystack) == tolower((unsigned char)*needle)) {
            if (strncasecmp(haystack, needle, nl) == 0) return true;
        }
    }
    return false;
}

static bool passes_heuristic(const cbm_gbuf_node_t *node) {
    if (!node || !node->label) return false;
    if (strcmp(node->label, "Function") != 0 && strcmp(node->label, "Method") != 0) return false;

    /* Skip tests */
    if (node->properties_json && strstr(node->properties_json, "\"is_test\":true")) {
        return false;
    }

    /* Heuristic 1: Cognitive complexity (if available) */
    if (node->properties_json) {
        yyjson_doc *doc = yyjson_read(node->properties_json, strlen(node->properties_json), 0);
        if (doc) {
            yyjson_val *root = yyjson_doc_get_root(doc);
            yyjson_val *cog = yyjson_obj_get(root, "cognitive");
            if (cog && yyjson_get_int(cog) > 5) {
                yyjson_doc_free(doc);
                return true;
            }
            yyjson_doc_free(doc);
        }
    }

    /* Heuristic 2: Naming patterns (common business logic verbs) */
    static const char *const logic_keywords[] = {
        "validate", "check", "calculate", "process", "apply", "rule", "compute", 
        "handle", "execute", "resolve", "verify", "authorize", "authenticate",
        "invoice", "payment", "order", "ship", "notify", "track"
    };
    for (size_t i = 0; i < sizeof(logic_keywords)/sizeof(char*); i++) {
        if (node->name && strcasestr_portable(node->name, logic_keywords[i])) return true;
    }

    /* Heuristic 3: Path patterns (common DDD/Clean Architecture folders) */
    static const char *const logic_paths[] = {
        "service", "domain", "use_case", "logic", "business", "controller", "handler"
    };
    for (size_t i = 0; i < sizeof(logic_paths)/sizeof(char*); i++) {
        if (node->file_path && strcasestr_portable(node->file_path, logic_paths[i])) return true;
    }

    return false;
}

typedef struct {
    cbm_gbuf_t *gb;
    int tagged;
} visitor_ctx_t;

static void business_logic_visitor(const cbm_gbuf_node_t *node, void *userdata) {
    visitor_ctx_t *ctx = userdata;
    if (passes_heuristic(node)) {
        char rule_qn[CBM_SZ_1K];
        snprintf(rule_qn, sizeof(rule_qn), "__rule__%s", node->qualified_name);
        
        /* Create BusinessRule node */
        int64_t rule_id = cbm_gbuf_upsert_node(ctx->gb, "BusinessRule", 
                                               node->name, rule_qn, 
                                               node->file_path, 
                                               node->start_line, 
                                               node->end_line, 
                                               "{}");
        
        /* Link Function -> BusinessRule */
        if (rule_id > 0) {
            cbm_gbuf_insert_edge(ctx->gb, node->id, rule_id, "IMPLEMENTS_RULE", "{}");
            ctx->tagged++;
        }
    }
}

void cbm_pipeline_tag_business_logic(cbm_pipeline_ctx_t *ctx) {
    visitor_ctx_t vctx = { .gb = ctx->gbuf, .tagged = 0 };
    cbm_gbuf_foreach_node(ctx->gbuf, business_logic_visitor, &vctx);

    if (vctx.tagged > 0) {
        char buf[CBM_SZ_32];
        snprintf(buf, sizeof(buf), "%d", vctx.tagged);
        cbm_log_info("pass.business_logic", "tagged", buf);
    }
}
