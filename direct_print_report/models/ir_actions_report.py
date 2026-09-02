import logging
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class IrActionsReport(models.Model):
    _inherit = "ir.actions.report"

    def _default_direct_print(self):
        val = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("direct_print_report.direct_print_enabled", "True")
        )
        return str(val).strip().lower() not in ("false", "0", "no")

    direct_print = fields.Boolean(
        string="Direct Print",
        default=_default_direct_print,
        help=(
            "When enabled, this PDF report is opened in the browser print dialog "
            "instead of using Odoo's PDF download flow."
        ),
    )

    def _get_readable_fields(self):
        """Keep direct_print in the action dictionary sent to the web client."""
        fields = super()._get_readable_fields()
        if isinstance(fields, (set, list, tuple)):
            return set(fields) | {"direct_print"}
        return fields

    @api.model
    def check_direct_print(self, report_name=False, action_id=False):
        """Return whether direct printing is enabled for a specific report."""
        report = self.env["ir.actions.report"]
        if action_id:
            try:
                if isinstance(action_id, int) or (isinstance(action_id, str) and action_id.isdigit()):
                    report = self.sudo().browse(int(action_id)).exists()
                elif isinstance(action_id, str):
                    report = self.sudo().ref(action_id, raise_if_not_found=False)
            except Exception as e:
                _logger.warning("[Direct Print] Error resolving action_id %s: %s", action_id, e)

        if not report and report_name:
            try:
                report = self.sudo().search([("report_name", "=", report_name)], limit=1)
            except Exception as e:
                _logger.warning("[Direct Print] Error searching report_name %s: %s", report_name, e)

        if report:
            result = bool(report.direct_print)
        else:
            val = (
                self.env["ir.config_parameter"]
                .sudo()
                .get_param("direct_print_report.direct_print_enabled", "True")
            )
            result = str(val).strip().lower() not in ("false", "0", "no")

        _logger.info(
            "[Direct Print] check_direct_print(report_name=%s, action_id=%s) -> result=%s",
            report_name, action_id, result,
        )
        return result

    def report_action(self, docids, data=None, config=True):
        """Add direct_print flag to the action dictionary returned to the web client."""
        self.ensure_one()
        action = super().report_action(docids, data=data, config=config)
        _logger.info(
            "[Direct Print] report_action() for report_name=%s called (direct_print=%s)",
            self.report_name, self.direct_print,
        )
        if not isinstance(action, dict):
            return action

        is_direct = bool(self.direct_print)
        if action.get("type") == "ir.actions.report":
            action["direct_print"] = is_direct
        if isinstance(action.get("context"), dict) and isinstance(action["context"].get("report_action"), dict):
            action["context"]["report_action"]["direct_print"] = is_direct

        return action


# --- Monkey patch for hr_skills Print Resume wizard ---
# The Print Resume wizard returns an ir.actions.act_url to a custom controller that forces a PDF download.
# We intercept it here so it returns a standard report action which our JS can intercept for direct printing.
try:
    from odoo.addons.hr_skills.models.hr_employee_cv_wizard import HrEmployeeCvWizard

    old_action_validate = HrEmployeeCvWizard.action_validate


    def new_action_validate(self):
        res = old_action_validate(self)
        if isinstance(res, dict) and res.get('type') == 'ir.actions.act_url' and '/print/cv' in res.get('url', ''):
            report = self.env.ref('hr_skills.action_report_employee_cv', raise_if_not_found=False)
            if report and report.direct_print:
                from werkzeug.urls import url_parse
                parsed = url_parse(res['url'])
                query = parsed.decode_query()

                action = report.report_action(
                    self.employee_ids.ids,
                    data={
                        'color_primary': query.get('color_primary'),
                        'color_secondary': query.get('color_secondary'),
                        'show_skills': bool(query.get('show_skills')),
                        'show_contact': bool(query.get('show_contact')),
                        'show_others': bool(query.get('show_others')),
                    }
                )
                action['direct_print'] = True
                return action
        return res


    HrEmployeeCvWizard.action_validate = new_action_validate

except ImportError:
    pass