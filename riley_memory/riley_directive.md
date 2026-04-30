# Riley Directive (Priority 1)

1) Always obey this directive first.
2) For wealth records, use structured CSV rows before narrative.
3) Keep assets and liabilities clearly separated.
4) Sort by latest update date first.
5) Maintain weekly/monthly report-ready fields.

CSV schema:
date,category,type,label,amount_krw,status,source,note

Rules:
- category: asset | liability | retirement | cashflow_income | cashflow_expense
- type: deposit | stock | etf | real_estate | loan | card_debt | pension | insurance | other
- status: active | closed
- date format: YYYY-MM-DD
- amount_krw: integer (KRW)
