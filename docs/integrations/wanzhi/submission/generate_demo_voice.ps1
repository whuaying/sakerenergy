param([Parameter(Mandatory=$true)][string]$Plan, [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voicePlan = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$voiceSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voiceSynth.SelectVoice('Microsoft Huihui Desktop')
    $voiceSynth.Rate = -1
    $voiceSynth.Volume = 100
    foreach ($scene in $voicePlan.scenes) {
        $voiceFile = Join-Path $OutputDirectory ('voice-{0:d2}.wav' -f [int]$scene.id)
        $voiceSynth.SetOutputToWaveFile($voiceFile)
        $voiceSynth.Speak([string]$scene.narration)
        $voiceSynth.SetOutputToNull()
    }
} finally {
    $voiceSynth.Dispose()
}
Write-Output 'Eight offline narration segments generated.'
