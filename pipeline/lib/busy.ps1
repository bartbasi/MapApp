# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
#
# Prints the Windows processes that make a heavy data job unsafe on this
# machine: any Android emulator (qemu), and any java.exe that used more than
# 2 seconds of CPU in a 10 second window (a Gradle build at work). An idle
# Gradle daemon is not counted. Prints nothing when the machine is quiet.
$procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'java' -or $_.Name -like 'qemu*' })
foreach ($p in $procs) { if ($p.Name -like 'qemu*') { "$($p.Name)($($p.Id))" } }
$java = @($procs | Where-Object { $_.Name -eq 'java' })
if ($java.Count -gt 0) {
  $before = @{}
  foreach ($p in $java) { $before[$p.Id] = $p.CPU }
  Start-Sleep -Seconds 10
  foreach ($p in $java) {
    $now = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
    if ($now -and ($now.CPU - $before[$p.Id]) -gt 2) { "java($($p.Id), busy)" }
  }
}
