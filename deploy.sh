#!/bin/bash

##
## Skrypt deploymentu Daszek na serwer produkcyjny
##
## Użycie:
##   ./deploy.sh [environment]
##
## Środowiska:
##   - staging (testowy)
##   - production (produkcyjny)
##

set -e

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Walidacja środowiska
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Nieprawidłowe środowisko: $ENVIRONMENT"
    echo "Użycie: ./deploy.sh [staging|production]"
    exit 1
fi

log_info "Deployment do środowiska: $ENVIRONMENT"

# Konfiguracja
if [[ "$ENVIRONMENT" == "production" ]]; then
    SERVER="user@topinstal.com.pl"
    WP_DIR="/var/www/html/topinstal.com.pl"
    CONFIRM_REQUIRED=true
else
    SERVER="user@staging.topinstal.com.pl"
    WP_DIR="/var/www/html/staging"
    CONFIRM_REQUIRED=false
fi

PLUGIN_DIR="$WP_DIR/wp-content/plugins/daszek"

# Potwierdzenie dla produkcji
if [[ "$CONFIRM_REQUIRED" == true ]]; then
    log_warn "UWAGA: Deploying na PRODUKCJĘ!"
    read -p "Czy jesteś pewien? (wpisz 'yes' aby kontynuować): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_error "Deployment anulowany."
        exit 1
    fi
fi

# Sprawdzenie wymagań lokalnych
log_info "Sprawdzanie wymagań..."

if ! command -v rsync &> /dev/null; then
    log_error "rsync nie jest zainstalowany!"
    exit 1
fi

if ! command -v ssh &> /dev/null; then
    log_error "ssh nie jest zainstalowany!"
    exit 1
fi

# Backup na serwerze
log_info "Tworzenie backupu na serwerze..."

ssh "$SERVER" "if [ -d '$PLUGIN_DIR' ]; then \
    tar -czf /tmp/daszek-backup-\$(date +%Y%m%d-%H%M%S).tar.gz -C '$WP_DIR/wp-content/plugins' daszek; \
    echo 'Backup utworzony w /tmp/'; \
fi"

# Kopia danych (tasks.json) na wszelki wypadek
log_info "Backup pliku tasks.json..."

ssh "$SERVER" "if [ -f '$WP_DIR/wp-content/uploads/daszek/tasks.json' ]; then \
    cp '$WP_DIR/wp-content/uploads/daszek/tasks.json' '/tmp/tasks-backup-\$(date +%Y%m%d-%H%M%S).json'; \
    echo 'tasks.json skopiowany do /tmp/'; \
fi"

# Rsync plików wtyczki
log_info "Synchronizacja plików..."

rsync -avz --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='uploads/daszek/tasks*.json' \
    --delete \
    "$SCRIPT_DIR/" \
    "$SERVER:$PLUGIN_DIR/"

# Uprawnienia
log_info "Ustawianie uprawnień..."

ssh "$SERVER" "
    chown -R www-data:www-data '$PLUGIN_DIR';
    chmod 755 '$PLUGIN_DIR';
    find '$PLUGIN_DIR' -type f -exec chmod 644 {} \;;
    find '$PLUGIN_DIR' -type d -exec chmod 755 {} \;;
    
    # Uprawnienia do zapisu dla katalogu uploads
    if [ -d '$WP_DIR/wp-content/uploads/daszek' ]; then
        chown -R www-data:www-data '$WP_DIR/wp-content/uploads/daszek';
        chmod 755 '$WP_DIR/wp-content/uploads/daszek';
        chmod 644 '$WP_DIR/wp-content/uploads/daszek/tasks.json';
    fi
"

# Flush cache i rewrite rules (jeśli używasz WP-CLI)
log_info "Flush cache WordPress..."

ssh "$SERVER" "
    cd '$WP_DIR';
    if command -v wp &> /dev/null; then
        wp cache flush --allow-root;
        wp rewrite flush --allow-root;
        echo 'Cache i rewrite rules wyczyszczone.';
    else
        echo 'WP-CLI nie jest dostępny. Pomiń flush cache.';
    fi
"

# Weryfikacja
log_info "Weryfikacja deploymentu..."

ssh "$SERVER" "
    if [ -f '$PLUGIN_DIR/daszek.php' ]; then
        echo 'Wtyczka wdrożona poprawnie.';
    else
        echo 'BŁĄD: Plik daszek.php nie istnieje!';
        exit 1;
    fi
"

log_info "✅ Deployment zakończony pomyślnie!"
log_info "URL: https://$([[ "$ENVIRONMENT" == "production" ]] && echo "topinstal.com.pl" || echo "staging.topinstal.com.pl")/daszek"

# Opcjonalnie: Uruchom testy smoke
if [[ "$ENVIRONMENT" == "production" ]]; then
    log_warn "Zalecane: Przeprowadź testy manualne w przeglądarce."
fi

