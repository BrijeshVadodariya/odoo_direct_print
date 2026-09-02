/** @odoo-module **/

import { registry } from "@web/core/registry";
import { env as webEnv } from "@web/env";

const HANDLER_NAME = "direct_print_report_handler";
const IFRAME_ID = "odoo_direct_print_iframe";

function getService(serviceName, env) {
    return env?.services?.[serviceName] || webEnv?.services?.[serviceName];
}

function getActiveIds(action, options = {}) {
    const context = action.context || {};

    if (Array.isArray(context.active_ids) && context.active_ids.length) {
        return context.active_ids;
    }
    if (context.active_id) {
        return [context.active_id];
    }
    if (Array.isArray(action.res_ids) && action.res_ids.length) {
        return action.res_ids;
    }
    if (action.res_id) {
        return [action.res_id];
    }
    if (Array.isArray(options.active_ids) && options.active_ids.length) {
        return options.active_ids;
    }
    if (options.res_id) {
        return [options.res_id];
    }
    return [];
}

function buildHtmlReportUrl(action, options = {}) {
    let reportName = action.report_name;
    if (!reportName && action.context && action.context.report_action) {
        reportName = action.context.report_action.report_name;
    }

    if (!reportName) {
        console.error("[Direct Print] No report_name found in action:", action);
        return null;
    }

    const activeIds = getActiveIds(action, options);
    let url = `/report/html/${encodeURIComponent(reportName)}`;

    if (activeIds.length) {
        url += `/${activeIds.join(",")}`;
    }

    const params = new URLSearchParams();
    const context = action.context || {};

    if (action.data && Object.keys(action.data).length) {
        params.set("options", JSON.stringify(action.data));
    }
    params.set("context", JSON.stringify(context));

    const query = params.toString();
    const fullUrl = query ? `${url}?${query}` : url;
    console.debug("[Direct Print] Built HTML Report URL:", fullUrl);
    return fullUrl;
}

function removePrintIframe() {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe) {
        iframe.remove();
        console.debug("[Direct Print] Removed iframe");
    }
}

function notify(env, message, type = "warning") {
    const notification = getService("notification", env);
    if (notification) {
        notification.add(message, { type });
    }
}

function openPrintPopup(htmlUrl, env) {
    console.debug("[Direct Print] Opening fallback print window for URL:", htmlUrl);
    const printWin = window.open(htmlUrl, "_blank", "width=800,height=900,scrollbars=yes,status=no,toolbar=no");
    if (printWin) {
        printWin.focus();
        printWin.onload = () => {
            try {
                printWin.print();
            } catch (err) {
                console.error("[Direct Print] Window print failed:", err);
            }
        };
    } else {
        notify(env, "Pop-up blocked. Please allow pop-ups for direct printing.", "danger");
    }
}

async function directPrintReportHandler(action, options, env) {
    console.debug("[Direct Print] Handler called with action:", action, "options:", options);

    if (!action || action.type !== "ir.actions.report") {
        console.debug("[Direct Print] Not a report action, skipping");
        return false;
    }

    let isDirectPrint = false;

    // Perform RPC check to obtain the current database configuration
    const orm = getService("orm", env);
    if (orm) {
        try {
            const rpcRes = await orm.call(
                "ir.actions.report",
                "check_direct_print",
                [],
                {
                    report_name: action.report_name || false,
                    action_id: action.id || false,
                }
            );
            if (typeof rpcRes === "boolean") {
                isDirectPrint = rpcRes;
            }
            console.debug("[Direct Print] RPC direct print check returned:", isDirectPrint);
        } catch (error) {
            console.warn("[Direct Print] Could not check report setting via RPC:", error);
            if (action.direct_print !== undefined) {
                isDirectPrint = Boolean(action.direct_print);
            } else if (action.context && action.context.direct_print !== undefined) {
                isDirectPrint = Boolean(action.context.direct_print);
            }
        }
    } else {
        if (action.direct_print !== undefined) {
            isDirectPrint = Boolean(action.direct_print);
        } else if (action.context && action.context.direct_print !== undefined) {
            isDirectPrint = Boolean(action.context.direct_print);
        }
    }

    console.debug("[Direct Print] Final direct print flag resolved to:", isDirectPrint);

    if (!isDirectPrint) {
        console.debug("[Direct Print] Direct print not enabled for this report, proceeding with standard flow.");
        return false;
    }

    if (action.report_type && action.report_type !== "qweb-html") {
        console.debug("[Direct Print] Overriding report_type to qweb-html");
        action.report_type = "qweb-html";
    }

    const htmlUrl = buildHtmlReportUrl(action, options);
    if (!htmlUrl) {
        notify(env, "Direct Print could not determine the report URL.", "danger");
        return true; // Prevent fallback PDF download
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        openPrintPopup(htmlUrl, env);
        return true;
    }

    removePrintIframe();

    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.setAttribute("title", "Direct Print Report");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);
    console.debug("[Direct Print] Iframe created and appended to document");

    return new Promise((resolve) => {
        let resolved = false;
        let timeoutId = null;
        let safetyTimeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (safetyTimeoutId) {
                window.clearTimeout(safetyTimeoutId);
                safetyTimeoutId = null;
            }
            if (iframe) {
                iframe.onload = null;
                iframe.onerror = null;
            }
        };

        const finish = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(true); // Return true so Odoo report service does NOT fallback to PDF download
            }
        };

        safetyTimeoutId = window.setTimeout(() => {
            if (!resolved) {
                console.warn("[Direct Print] Iframe load timed out, using window popup fallback.");
                removePrintIframe();
                openPrintPopup(htmlUrl, env);
                finish();
            }
        }, 5000);

        iframe.onload = () => {
            console.debug("[Direct Print] Iframe loaded successfully");
            timeoutId = window.setTimeout(() => {
                try {
                    const printWindow = iframe.contentWindow;
                    if (printWindow) {
                        console.debug("[Direct Print] Triggering print() on iframe contentWindow");
                        printWindow.focus();
                        printWindow.print();
                    } else {
                        console.error("[Direct Print] Cannot access iframe contentWindow, using popup fallback");
                        openPrintPopup(htmlUrl, env);
                    }
                    window.setTimeout(removePrintIframe, 3000);
                } catch (error) {
                    console.error("[Direct Print] Iframe print error:", error, "- falling back to popup");
                    removePrintIframe();
                    openPrintPopup(htmlUrl, env);
                }
                finish();
            }, 600);
        };

        iframe.onerror = (error) => {
            console.error("[Direct Print] Iframe error loading report URL:", htmlUrl, error);
            removePrintIframe();
            openPrintPopup(htmlUrl, env);
            finish();
        };

        iframe.src = htmlUrl;
    });
}

registry
    .category("ir.actions.report handlers")
    .add(HANDLER_NAME, directPrintReportHandler, { sequence: 0 });