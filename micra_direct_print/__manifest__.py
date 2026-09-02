{
    'name': 'Odoo Direct Print | POS Direct Print | Direct Printing from Desktop, Mobile, Android & iOS',

    'summary': 'Directly print reports using browser print dialog without downloading PDF files',

    'description': """
        Direct Print Report Module for Odoo 18.0
        =========================================
        - Add Direct Print option in Technical -> Reports (ir.actions.report)
        - Add Direct Print configuration in Settings -> General Settings
        - Automatically open browser print preview and print dialog when report is printed
    """,

    'author': "Micra Digital",
    'website': "www.micra.digital",
    'version': '18.0.1.0.0',
    'category': 'Inventory',
    'installable': True,
    'application': True,
    'license': 'OPL-1',
    'price': 9.99,
    'currency': 'USD',

    'depends': ['base', 'web'],

    'data': [
        'views/ir_actions_report_views.xml',
        'views/res_config_settings_views.xml',
    ],

    'assets': {
        'web.assets_backend': [
            'micra_direct_print/static/src/js/direct_print_handler.js',
        ],
    },

    'post_init_hook': 'post_init_hook',

    'images': ['static/description/banner.png'],
}

