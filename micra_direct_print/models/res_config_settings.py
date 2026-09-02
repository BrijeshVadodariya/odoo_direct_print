from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    direct_print_enabled = fields.Boolean(
        string="Direct Print",
        config_parameter="micra_direct_print.direct_print_enabled",
        help="All Reports Of Direct Print Automated"
    )

    def set_values(self):
        super().set_values()
        new_val = self.direct_print_enabled
        self.env['ir.actions.report'].sudo().search([]).write({
            'direct_print': new_val
        })

