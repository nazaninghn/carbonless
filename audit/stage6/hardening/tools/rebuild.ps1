$sp="C:\Users\UP\AppData\Local\Temp\claude\D--ACADEMIA-PROJECTS-CARBONLESS\b954cafe-f9a3-4334-be50-4ecff1db1b77\scratchpad"
$src="D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\carbonless_backend"
$dst="$sp\s6_proto2\carbonless_backend"
if (Test-Path "$sp\s6_proto2") { Remove-Item "$sp\s6_proto2" -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null
robocopy $src $dst /E /XD venv __pycache__ media staticfiles .git node_modules /XF db.sqlite3 *.pyc .env backend.log /NFL /NDL /NJH /NJS /NP | Out-Null
$env:PYTHONIOENCODING="utf-8"
$py="$src\venv\Scripts\python.exe"
& $py -I "$sp\dr19v2\patch.py"
& $py -I "$sp\dr19v2\patch2.py"
Copy-Item "$sp\dr19v2\test_dr19.py" "$dst\questionnaire\test_dr19.py" -Force
Copy-Item "$sp\dr19v2\test_dr19_routes.py" "$dst\questionnaire\test_dr19_routes.py" -Force
Set-Location $dst
$env:ALLOW_DEV_SECRET="true"
& $py manage.py check 2>&1 | Select-Object -Last 2
& $py manage.py makemigrations --check --dry-run 2>&1 | Select-Object -Last 2
