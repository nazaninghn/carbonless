import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')
c = sqlite3.connect(r'file:C:/Users/UP/AppData/Local/Temp/claude/D--ACADEMIA-PROJECTS-CARBONLESS/b954cafe-f9a3-4334-be50-4ecff1db1b77/scratchpad/devcopy/db_copy.sqlite3?mode=ro', uri=True)
q = lambda s, *a: c.execute(s, a).fetchall()
cols = [r[1] for r in q('pragma table_info(questionnaire_carbonreport)')]
print('report columns:', cols)
for rid in (6, 8, 15):
    r = dict(zip(cols, q('select * from questionnaire_carbonreport where id=?', rid)[0]))
    print(rid, {k: r[k] for k in ('company_id', 'reporting_year', 'title', 'status', 'current_step', 'created_by_id', 'created_at', 'updated_at', 'signed_at', 'edited_after_signing_at')})
print('--- 7C-2 step per report (signature) vs signed_at')
for rid in (6, 8, 15, 28, 31):
    print(rid, q("select step_id, is_skipped, completed_at from questionnaire_reportstep where report_id=? and step_id in ('7C-2')", rid),
          q('select signed_at from questionnaire_carbonreport where id=?', rid))
print('--- step counts and answered entry steps of 15')
print(q('select count(*) from questionnaire_reportstep where report_id=15'))
print(q("select step_id, substr(answer,1,90) from questionnaire_reportstep where report_id=15 and step_id in ('3A-5','4A-1','3B-7','K3C5-2','4B-2') order by step_id"))
print('--- same answers on 6 and 8?')
for rid in (6, 8, 15):
    print(rid, q("select substr(answer,1,60) from questionnaire_reportstep where report_id=? and step_id='3A-5'", rid))
print('--- all entries of company 1 (any status/year), and entries with NULL company')
for r in q("select id, year, month, status, description, quantity, calculated_co2e_kg, created_at, user_id from emissions_emissionentry where company_id=1 or company_id is null order by id"):
    print(r)
print('--- activity log rows mentioning company 1 (counts by action)')
al = [r[1] for r in q('pragma table_info(accounts_activitylog)')]
print(al)
print(q("select action, count(*) from accounts_activitylog where metadata like '%\"company_id\": 1,%' or metadata like '%\"company_id\": 1}%' group by action order by 2 desc limit 25"))
print(q("select id, action, substr(detail,1,100), created_at from accounts_activitylog where (metadata like '%\"company_id\": 1,%' or metadata like '%\"company_id\": 1}%') and (action like '%delete%' or action like '%remov%' or action like '%reset%' or action like '%complet%' or action like '%entry_%') order by id limit 25"))
print('--- when did migration 0010/0012 run, and the legacy flag')
print(q("select app, name, applied from django_migrations where app='questionnaire' order by id desc limit 5"))
print(q('select id, legacy_duplicate_year from questionnaire_carbonreport where id in (6,8,15,28,31)'))
