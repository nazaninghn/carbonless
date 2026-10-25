$sp="C:\Users\UP\AppData\Local\Temp\claude\D--ACADEMIA-PROJECTS-CARBONLESS\b954cafe-f9a3-4334-be50-4ecff1db1b77\scratchpad"
$dev="D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\carbonless_backend\db.sqlite3"
$py="D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\carbonless_backend\venv\Scripts\python.exe"
$h0=(Get-FileHash $dev -Algorithm SHA256).Hash.ToLower()
$env:ALLOW_DEV_SECRET="true"; $env:PYTHONIOENCODING="utf-8"
if (Test-Path "$sp\s6_drill") { Remove-Item "$sp\s6_drill" -Recurse -Force }
robocopy "$sp\s6_proto2\carbonless_backend" "$sp\s6_drill\carbonless_backend" /E /XD __pycache__ /XF db.sqlite3 *.pyc /NFL /NDL /NJH /NJS /NP | Out-Null
Copy-Item $dev "$sp\s6_drill\carbonless_backend\db.sqlite3" -Force
Set-Location "$sp\s6_drill\carbonless_backend"
$probe = @"
from emissions.models import EmissionEntry
from questionnaire.models import CarbonReport, ReportStep
from accounts.models import ActivityLog
from django.db.models import Sum
import hashlib, json
rows = list(EmissionEntry.objects.order_by('pk').values_list('pk','company_id','year','status','emission_factor_id','quantity','calculated_co2e_kg','factor_value_snapshot'))
h = hashlib.sha256(json.dumps([[str(x) for x in r] for r in rows]).encode()).hexdigest()[:16]
tot = EmissionEntry.objects.filter(status='approved').aggregate(s=Sum('calculated_co2e_kg'))['s']
cols = [f.name for f in CarbonReport._meta.get_fields()]
try:
    maps = CarbonReport.objects.exclude(applied_factors__isnull=True).exclude(applied_factors={}).count()
    held = [r.pk for r in CarbonReport.objects.all() if (r.applied_factors or {}).get('hold')]
except Exception as exc:
    maps, held = 'column absent', 'column absent'
print('STATE entries=%d approved_kg=%s entries_hash=%s reports=%d steps=%d locked=%d maps=%s held=%s' % (len(rows), tot, h, CarbonReport.objects.count(), ReportStep.objects.count(), CarbonReport.objects.exclude(signed_at=None).count(), maps, held))
"@
function State($label) { Write-Output "--- $label"; & $py manage.py shell -c $probe 2>&1 | Where-Object { $_ -match '^STATE' } | ForEach-Object { "$_" } }
"=== B. forward / freeze / rollback / forward drill on a fresh copy of the dev DB"
& $py manage.py migrate 2>&1 | Select-String -Pattern "Applying questionnaire.001[123]" | ForEach-Object { "$_" }
State "after forward migration (0011-0013)"
& $py manage.py freeze_applied_factors --apply 2>&1 | ForEach-Object { "$_" }
State "after freeze --apply (frozen: provable; held: report 15)"
& $py manage.py report_factor_provenance 2>&1 | Select-Object -First 3 | ForEach-Object { "$_" }
"--- rollback to 0012"
& $py manage.py migrate questionnaire 0012 2>&1 | Select-String -Pattern "Unapplying" | ForEach-Object { "$_" }
State "after rollback (column dropped; every entry and total unchanged)"
"--- forward again, then re-run freeze"
& $py manage.py migrate questionnaire 2>&1 | Select-String -Pattern "Applying questionnaire.0013" | ForEach-Object { "$_" }
State "after re-applying 0013 (maps empty again)"
& $py manage.py freeze_applied_factors --apply 2>&1 | ForEach-Object { "$_" }
State "after freeze --apply again (maps and the hold restored)"
"original dev DB untouched: " + ((Get-FileHash $dev -Algorithm SHA256).Hash.ToLower() -eq $h0)
