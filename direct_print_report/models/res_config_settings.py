from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    direct_print_enabled = fields.Boolean(
        string="Direct Print",
        config_parameter="direct_print_report.direct_print_enabled",
        help="All Reports Of Direct Print Automated"
    )

    def set_values(self):
        super().set_values()
        new_val = self.direct_print_enabled
        self.env['ir.actions.report'].sudo().search([]).write({
            'direct_print': new_val
        })

