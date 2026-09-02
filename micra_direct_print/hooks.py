from odoo import api, SUPERUSER_ID


def post_init_hook(env, registry=None):
    if not isinstance(env, api.Environment):
        env = api.Environment(env, SUPERUSER_ID, {})
    val = env['ir.config_parameter'].sudo().get_param('micra_direct_print.direct_print_enabled', 'True')
    enabled = str(val).strip().lower() not in ('false', '0', 'no')
    env['ir.actions.report'].sudo().search([]).write({'direct_print': enabled})

