# =====================================================
#  deploy.ps1 - Deploiement automatique Tour des Stades
#  Usage : double-cliquer sur deployer.bat
# =====================================================

$ErrorActionPreference = "Stop"
$projet = "C:\Users\oceje\Documents\perso\projet site internet"

function Pause-Et-Quitter {
    Write-Host ""
    Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

try {

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  DEPLOIEMENT - Tour des Stades" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    # 1. Aller dans le dossier projet
    Write-Host "[1/6] Navigation vers le projet..." -ForegroundColor Yellow
    Set-Location $projet

    # 2. Pull depuis GitHub (AVANT le add/commit)
    Write-Host "[2/6] Git pull origin main..." -ForegroundColor Yellow
    git pull origin main --no-edit
    if ($LASTEXITCODE -ne 0) { throw "Echec git pull" }

    # 3. Ajouter tous les fichiers modifies
    Write-Host "[3/6] Git add..." -ForegroundColor Yellow
    git add .

    # 4. Commit avec message horodate
    $date = Get-Date -Format "yyyy-MM-dd HH:mm"
    $msg = "update $date"
    Write-Host "[4/6] Git commit : $msg" -ForegroundColor Yellow
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  -> Rien a committer, on continue." -ForegroundColor DarkGray
    } else {
        git commit -m $msg
        if ($LASTEXITCODE -ne 0) { throw "Echec git commit" }
    }

    # 5. Push vers GitHub
    Write-Host "[5/6] Git push..." -ForegroundColor Yellow
    git push
    if ($LASTEXITCODE -ne 0) { throw "Echec git push" }

    # 6. Deploiement Firebase Hosting
    Write-Host "[6/6] Firebase deploy..." -ForegroundColor Yellow
    firebase deploy
    if ($LASTEXITCODE -ne 0) { throw "Echec firebase deploy" }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOIEMENT TERMINE avec succes !" -ForegroundColor Green
    Write-Host "  https://carte-des-stades-9b6d7.web.app" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ERREUR : $_" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Pause-Et-Quitter
