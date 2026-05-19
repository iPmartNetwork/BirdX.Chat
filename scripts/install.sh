#!/usr/bin/env bash

set -uo pipefail

handle_exit() {
  local exit_code=$?
  if [[ "$exit_code" -eq 0 ]]; then
    clear
    return 0
  fi

  printf "\n[BIRDX] Script exited with code %s.\n" "$exit_code" >&2
  if [[ -f "$LOG_FILE" ]]; then
    printf "[BIRDX] Review the log at %s for the last recorded step.\n" "$LOG_FILE" >&2
  fi
}

handle_interrupt() {
  handle_exit
  exit 130
}

trap 'handle_interrupt' INT TERM
trap 'handle_exit' EXIT

APP_NAME="birdx"
INSTALL_DIR="/opt/birdx"
LOG_FILE="/opt/birdx/logs/install.log"
REPO_URL="${REPO_URL:-https://github.com/iPmartNetwork/BirdX.git}"
SERVICE_USER="birdx"
SERVICE_GROUP="birdx"
SERVICE_FILE="/etc/systemd/system/birdx.service"
LEGO_RENEW_SERVICE_FILE="/etc/systemd/system/birdx-lego-renew.service"
LEGO_RENEW_TIMER_FILE="/etc/systemd/system/birdx-lego-renew.timer"
NGINX_SITE_FILE="/etc/nginx/sites-available/birdx"
NGINX_ENABLED_FILE="/etc/nginx/sites-enabled/birdx"
TURN_CONFIG_FILE="/etc/turnserver.conf"
TURN_DEFAULT_FILE="/etc/default/coturn"
DEFAULT_SERVER_PORT="5174"
DEFAULT_CLIENT_PORT="80"
DEFAULT_FILE_UPLOAD="true"
DEFAULT_MAX_UPLOAD="78643200"
DEFAULT_RETENTION_DAYS="7"
DEFAULT_TEXT_RETENTION_DAYS="0"
DEFAULT_ACCOUNT_CREATION="true"
DEFAULT_TURN_MIN_PORT="49160"
DEFAULT_TURN_MAX_PORT="49200"
DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES="5242880"
DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS="480"
NODE_MAJOR="24"
SCRIPT_REMOTE_URL="${SCRIPT_REMOTE_URL:-https://raw.githubusercontent.com/iPmartNetwork/BirdX/master/scripts/install.sh}"
LOG_LINES="${LOG_LINES:-100}"
CERT_INSTALL_DIR="/etc/ssl/birdx"
ACME_WEBROOT="/var/lib/birdx/certbot"
LEGO_STATE_DIR="/var/lib/birdx/lego"
LEGO_BIN="/usr/local/bin/lego"

# Mirror URLs
MIRROR_NODESOURCE="${MIRROR_NODESOURCE:-}"
MIRROR_APT_EXTRA="${MIRROR_APT_EXTRA:-}"
MIRROR_NPM="${MIRROR_NPM:-}"

SUDO=""
OS_ID=""
OS_ID_LIKE=""
DEPLOY_MODE="ip"
DOMAIN_NAMES=()
INVALID_DOMAIN_NAMES=()
CERTBOT_EMAIL=""
SERVER_PORT="$DEFAULT_SERVER_PORT"
CLIENT_PORT="$DEFAULT_CLIENT_PORT"
FILE_UPLOAD="$DEFAULT_FILE_UPLOAD"
MAX_UPLOAD="$DEFAULT_MAX_UPLOAD"
RETENTION_DAYS="$DEFAULT_RETENTION_DAYS"
TEXT_RETENTION_DAYS="$DEFAULT_TEXT_RETENTION_DAYS"
ACCOUNT_CREATION="$DEFAULT_ACCOUNT_CREATION"
NGINX_SERVER_NAME="_"
TURN_ENABLED="false"
TURN_HOST=""
TURN_PUBLIC_IP=""
TURN_REALM=""
TURN_USERNAME="birdx"
TURN_CREDENTIAL=""
TURN_URLS=""
TURN_MIN_PORT="$DEFAULT_TURN_MIN_PORT"
TURN_MAX_PORT="$DEFAULT_TURN_MAX_PORT"
CURRENT_ENV_FILE=""
PROMPT_FD=0
PROMPT_FD_OUT=1
DB_BACKUP_PATH=""
DB_BACKUP_PASSWORD=""
RESTORE_BACKUP_QUIET="no"
LAST_UNZIP_OUTPUT=""
LAST_UNZIP_STATUS=0
EXTRACT_SOURCE_DIR=""
EXTRACT_ENV_SRC=""
SOURCE_MODE=""
SOURCE_ZIP_PATH=""
CERT_MODE="http"
CERTBOT_IP_ADDRESS=""
MANUAL_CERT_FULLCHAIN_PATH=""
MANUAL_CERT_PRIVKEY_PATH=""
NODE_EXEC_PATH=""

log() {
  local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local log_dir="$(dirname "$LOG_FILE")"

  printf "[BIRDX] %s\n" "$1"

  if [[ -d "$log_dir" ]]; then
    printf "[%s] [BIRDX] %s\n" "$timestamp" "$1" >> "$LOG_FILE" 2>/dev/null || true
  fi
}


ensure_log_dir() {
  local log_dir="$(dirname "$LOG_FILE")"
  if [[ ! -d "$log_dir" ]]; then
    run_as_root mkdir -p "$log_dir"
    log "Created log directory: $log_dir"
  fi
}

warn() {
  local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  printf "[%s] WARNING: %s\n" "BIRDX" "$*" >&2
  if [[ -f "$LOG_FILE" ]]; then
    printf "[%s] [BIRDX] WARNING: %s\n" "$timestamp" "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

fail() {
  local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  printf "[%s] ERROR: %s\n" "BIRDX" "$*" >&2
  if [[ -f "$LOG_FILE" ]]; then
    printf "[%s] [BIRDX] ERROR: %s\n" "$timestamp" "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi
  exit 1
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

press_enter_to_continue() {
  printf "\nPress Enter to return to the main menu..." >&$PROMPT_FD_OUT
  if ! IFS= read -r -u "$PROMPT_FD" _; then
    _=""
  fi
}

run_silent() {
  local output
  # Append command being run to log file
  if [[ -f "$LOG_FILE" ]]; then
    printf "[%s] Running: %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi

  if ! output="$("$@" 2>&1)"; then
    # Log the failure
    if [[ -f "$LOG_FILE" ]]; then
      printf "[%s] FAILED: %s\n%s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$output" >> "$LOG_FILE" 2>/dev/null || true
    fi
    # Show error to user
    printf "\n[ERROR] Command failed: %s\n" "$*"
    printf "%s\n" "$output"
    return 1
  else
    # Log success + output
    if [[ -f "$LOG_FILE" ]]; then
      printf "[%s] SUCCESS: %s\n%s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$output" >> "$LOG_FILE" 2>/dev/null || true
    fi
  fi
}

run_logged_quiet() {
  local output
  if [[ -f "$LOG_FILE" ]]; then
    printf "[%s] Running: %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi

  if ! output="$("$@" 2>&1)"; then
    if [[ -f "$LOG_FILE" ]]; then
      printf "[%s] FAILED: %s\n%s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$output" >> "$LOG_FILE" 2>/dev/null || true
    fi
    return 1
  fi

  if [[ -f "$LOG_FILE" ]]; then
    printf "[%s] SUCCESS: %s\n%s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$output" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

run_unzip_capture() {
  local output=""
  local status=0
  if output="$(run_as_root "$@" </dev/null 2>&1)"; then
    status=0
  else
    status=$?
  fi
  LAST_UNZIP_OUTPUT="$output"
  LAST_UNZIP_STATUS="$status"
  [[ "$status" -eq 0 ]]
}

output_looks_password_related() {
  local text=""
  text="$(printf "%s" "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$text" == *password* || "$text" == *encrypted* || "$text" == *"unable to get password"* || "$text" == *"incorrect password"* || "$text" == *"skipping:"* ]]
}


run_as_root() {
  if [[ -n "$SUDO" ]]; then
    $SUDO "$@"
  else
    "$@"
  fi
}

run_as_root_output() {
  if [[ -n "$SUDO" ]]; then
    $SUDO "$@"
  else
    "$@"
  fi
}

run_in_install_dir() {
  run_silent run_as_root bash -lc "cd '$INSTALL_DIR' && $*"
}

run_in_install_dir_output() {
  if [[ -n "$SUDO" ]]; then
    $SUDO bash -lc "cd '$INSTALL_DIR' && $*"
  else
    bash -lc "cd '$INSTALL_DIR' && $*"
  fi
}

dir_has_entries() {
  local target_dir="$1"
  local first_entry=""
  first_entry="$(run_as_root_output find "$target_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)"
  [[ -n "$first_entry" ]]
}

init_prompt_io() {
  if [[ -r /dev/tty && -w /dev/tty ]]; then
    exec 3</dev/tty
    exec 4>/dev/tty
    PROMPT_FD=3
    PROMPT_FD_OUT=4
    return 0
  fi
  if [[ -t 0 ]]; then
    PROMPT_FD=0
    PROMPT_FD_OUT=1
    return 0
  fi
  fail "No interactive TTY detected. Run this script in an interactive shell."
}

prompt_read() {
  local prompt="$1"
  local __result_var="$2"
  local input=""
  printf "%s" "$prompt" >&$PROMPT_FD_OUT
  if ! IFS= read -r -u "$PROMPT_FD" input; then
    input=""
  fi
  printf -v "$__result_var" "%s" "$input"
}

prompt_non_empty() {
  local prompt="$1"
  local value=""
  while true; do
    prompt_read "$prompt: " value
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ -n "$value" ]]; then
      printf "%s" "$value"
      return 0
    fi
    printf "Please provide a value.\n"
  done
}

prompt_secret() {
  local prompt="$1"
  local value=""
  while true; do
    printf "%s: " "$prompt" >&$PROMPT_FD_OUT
    if ! IFS= read -ers -u "$PROMPT_FD" value; then
      value=""
    fi
    printf "\n" >&$PROMPT_FD_OUT
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ -n "$value" ]]; then
      printf "%s" "$value"
      return 0
    fi
    printf "Please provide a value.\n"
  done
}

prompt_secret_optional() {
  local prompt="$1"
  local value=""
  printf "%s: " "$prompt" >&$PROMPT_FD_OUT
  if ! IFS= read -ers -u "$PROMPT_FD" value; then
    value=""
  fi
  printf "\n" >&$PROMPT_FD_OUT
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf "%s" "$value"
}

prompt_yes_no() {
  local prompt="$1"
  local default="$2"
  local value=""
  while true; do
    prompt_read "$prompt [y/n] (default: $default): " value
    value="$(printf "%s" "$value" | tr '[:upper:]' '[:lower:]')"
    if [[ -z "$value" ]]; then
      value="$default"
    fi
    case "$value" in
      y|yes) printf "yes"; return 0 ;;
      n|no) printf "no"; return 0 ;;
      *) printf "Please answer y or n.\n" ;;
    esac
  done
}

prompt_port() {
  local value=""
  while true; do
    prompt_read "Enter server port (default: $DEFAULT_SERVER_PORT): " value
    if [[ -z "$value" ]]; then
      printf "%s" "$DEFAULT_SERVER_PORT"
      return 0
    fi
    if [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= 65535 )); then
      printf "%s" "$value"
      return 0
    fi
    printf "Port must be an integer between 1 and 65535.\n"
  done
}

prompt_client_port() {
  local default_port="${1:-$DEFAULT_CLIENT_PORT}"
  local value=""
  while true; do
    prompt_read "Enter client (nginx) port (default: $default_port): " value
    if [[ -z "$value" ]]; then
      printf "%s" "$default_port"
      return 0
    fi
    if [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= 65535 )); then
      printf "%s" "$value"
      return 0
    fi
    printf "Port must be an integer between 1 and 65535.\n"
  done
}

prompt_retention_days() {
  local value=""
  while true; do
    prompt_read "Enter files auto deletion interval in days (0 disables, default: $DEFAULT_RETENTION_DAYS): " value
    if [[ -z "$value" ]]; then
      value="$DEFAULT_RETENTION_DAYS"
    fi
    if [[ "$value" =~ ^[0-9]+$ ]]; then
      printf "%s" "$value"
      return 0
    fi
    printf "Please enter a non-negative integer.\n"
  done
}

prompt_text_retention_days() {
  local value=""
  while true; do
    prompt_read "Enter text-only message auto deletion interval in days (0 disables, default: $DEFAULT_TEXT_RETENTION_DAYS): " value
    if [[ -z "$value" ]]; then
      value="$DEFAULT_TEXT_RETENTION_DAYS"
    fi
    if [[ "$value" =~ ^[0-9]+$ ]]; then
      printf "%s" "$value"
      return 0
    fi
    printf "Please enter a non-negative integer.\n"
  done
}

is_ipv4_address() {
  local value="$1"
  [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

normalize_domain_name() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="$(printf "%s" "$value" | tr '[:upper:]' '[:lower:]')"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%:*}"
  value="${value%.}"
  printf "%s" "$value"
}

is_valid_domain_name() {
  local value="$1"
  [[ "$value" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]]
}

read_nginx_server_name_from_existing_config() {
  if [[ ! -f "$NGINX_SITE_FILE" ]]; then
    return 1
  fi

  local existing=""
  existing="$(run_as_root_output awk '
    /^[[:space:]]*server_name[[:space:]]+/ {
      sub(/^[[:space:]]*server_name[[:space:]]+/, "")
      sub(/;[[:space:]]*$/, "")
      print
      exit
    }
  ' "$NGINX_SITE_FILE" 2>/dev/null | tr -d '\r')" || existing=""

  if [[ -n "$existing" ]]; then
    NGINX_SERVER_NAME="$existing"
    return 0
  fi

  return 1
}

detect_public_ip() {
  if ! have_cmd curl; then
    return 1
  fi

  local endpoint=""
  local ip=""
  for endpoint in "https://api.ipify.org" "https://ifconfig.me/ip"; do
    ip="$(curl -fsS --max-time 4 "$endpoint" 2>/dev/null | tr -d '[:space:]')" || ip=""
    if is_ipv4_address "$ip"; then
      printf "%s" "$ip"
      return 0
    fi
  done

  return 1
}

normalize_turn_host_input() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#turn:}"
  value="${value#turns:}"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%\?*}"
  if [[ "$value" == *":3478" ]]; then
    value="${value%:3478}"
  fi
  printf "%s" "$value"
}

prompt_turn_host() {
  local default_host="${1:-}"
  local value=""
  while true; do
    if [[ -n "$default_host" ]]; then
      prompt_read "Enter TURN hostname or public IPv4 (default: $default_host): " value
      if [[ -z "$value" ]]; then
        value="$default_host"
      fi
    else
      prompt_read "Enter TURN hostname or public IPv4: " value
    fi

    value="$(normalize_turn_host_input "$value")"
    if [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]]; then
      printf "%s" "$value"
      return 0
    fi
    printf "Use a hostname or public IPv4 address without protocol, path, or port.\n"
  done
}

generate_turn_credential() {
  local secret=""
  secret="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true)"
  if (( ${#secret} < 32 )) && have_cmd openssl; then
    secret="$(openssl rand -base64 32 2>/dev/null | tr '+/' '-_' | tr -d '=[:space:]' | head -c 32 || true)"
  fi
  if (( ${#secret} < 32 )); then
    secret="$(date +%s%N | sha256sum | awk '{print $1}' | head -c 32)"
  fi
  printf "%s" "$secret"
}

build_turn_urls() {
  local host="$1"
  printf "turn:%s:3478?transport=udp turn:%s:3478?transport=tcp" "$host" "$host"
}

prompt_turn_options() {
  TURN_ENABLED="false"
  TURN_HOST=""
  TURN_PUBLIC_IP=""
  TURN_REALM=""
  TURN_USERNAME="birdx"
  TURN_CREDENTIAL=""
  TURN_URLS=""

  if [[ "$(prompt_yes_no "Install and configure coturn TURN server for reliable voice calls?" "yes")" != "yes" ]]; then
    return 0
  fi

  local default_host=""
  if (( ${#DOMAIN_NAMES[@]} > 0 )); then
    default_host="${DOMAIN_NAMES[0]}"
  elif [[ -n "$CERTBOT_IP_ADDRESS" ]]; then
    default_host="$CERTBOT_IP_ADDRESS"
  else
    default_host="$(detect_public_ip || true)"
  fi

  TURN_ENABLED="true"
  TURN_HOST="$(prompt_turn_host "$default_host")"
  TURN_REALM="$TURN_HOST"
  TURN_CREDENTIAL="$(generate_turn_credential)"
  TURN_URLS="$(build_turn_urls "$TURN_HOST")"

  if is_ipv4_address "$TURN_HOST"; then
    TURN_PUBLIC_IP="$TURN_HOST"
  else
    TURN_PUBLIC_IP="$(detect_public_ip || true)"
  fi

  log "TURN will be configured for ${TURN_HOST} with username ${TURN_USERNAME}."
}

apply_turn_env_settings() {
  local env_file="${1:-$INSTALL_DIR/.env}"
  if [[ "$TURN_ENABLED" != "true" ]]; then
    return 0
  fi
  if [[ -z "$TURN_URLS" || -z "$TURN_USERNAME" || -z "$TURN_CREDENTIAL" ]]; then
    fail "TURN is enabled, but TURN environment values are incomplete."
  fi

  replace_env_value "$env_file" "APP_TURN_URLS" "$TURN_URLS"
  replace_env_value "$env_file" "APP_TURN_USERNAME" "$TURN_USERNAME"
  replace_env_value "$env_file" "APP_TURN_CREDENTIAL" "$TURN_CREDENTIAL"
}

log_turn_firewall_hint() {
  log "TURN firewall ports to allow: 3478 TCP, 3478 UDP, and ${TURN_MIN_PORT}-${TURN_MAX_PORT} UDP."
}

configure_turn_server() {
  if [[ "$TURN_ENABLED" != "true" ]]; then
    return 0
  fi

  if ! dpkg -s coturn >/dev/null 2>&1; then
    fail "coturn is not installed. Re-run installation so required packages can be installed."
  fi

  local external_ip_line=""
  if [[ -z "$TURN_PUBLIC_IP" ]] && ! is_ipv4_address "$TURN_HOST"; then
    TURN_PUBLIC_IP="$(detect_public_ip || true)"
  fi
  if [[ -n "$TURN_PUBLIC_IP" ]]; then
    external_ip_line="external-ip=${TURN_PUBLIC_IP}"
  fi

  log "Writing coturn config to ${TURN_CONFIG_FILE}..."
  run_silent run_as_root tee "$TURN_CONFIG_FILE" >/dev/null <<EOF
# Managed by BirdX installer.
listening-port=3478
fingerprint
lt-cred-mech
realm=${TURN_REALM}
server-name=${TURN_REALM}
user=${TURN_USERNAME}:${TURN_CREDENTIAL}
total-quota=100
stale-nonce=600
no-loopback-peers
no-multicast-peers
no-cli
min-port=${TURN_MIN_PORT}
max-port=${TURN_MAX_PORT}
${external_ip_line}
syslog
EOF

  log "Enabling coturn startup in ${TURN_DEFAULT_FILE}..."
  run_silent run_as_root tee "$TURN_DEFAULT_FILE" >/dev/null <<'EOF'
TURNSERVER_ENABLED=1
EOF

  local turn_service="coturn.service"
  if run_as_root systemctl list-unit-files | grep -q '^coturn\.service'; then
    turn_service="coturn.service"
  elif run_as_root systemctl list-unit-files | grep -q '^turnserver\.service'; then
    turn_service="turnserver.service"
  fi

  run_silent run_as_root systemctl daemon-reload
  run_silent run_as_root systemctl enable "$turn_service" || fail "Failed to enable ${turn_service}."
  run_silent run_as_root systemctl restart "$turn_service" || fail "Failed to start ${turn_service}."
  log "coturn is running as ${turn_service}."
  log_turn_firewall_hint
}

normalize_path_input() {
  local value="$1"
  if [[ "$value" == "~"* ]]; then
    printf "%s" "${value/#\~/$HOME}"
    return 0
  fi
  printf "%s" "$value"
}

strip_surrounding_quotes() {
  local value="$1"
  local first="${value:0:1}"
  local last="${value: -1}"
  if [[ ( "$first" == "\"" && "$last" == "\"" ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
    printf "%s" "${value:1:${#value}-2}"
    return 0
  fi
  printf "%s" "$value"
}

strip_carriage_returns() {
  local value="$1"
  printf "%s" "$value" | tr -d '\r'
}

file_exists_path() {
  local path="$1"
  if [[ -f "$path" ]]; then
    return 0
  fi
  if [[ -n "$SUDO" ]]; then
    $SUDO test -f "$path"
    return $?
  fi
  return 1
}

resolve_file_path() {
  local raw="$1"
  local value=""
  value="$(normalize_path_input "$raw")"
  value="$(strip_surrounding_quotes "$value")"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="$(strip_carriage_returns "$value")"
  if [[ -z "$value" ]]; then
    return 1
  fi

  if [[ "$value" == /* ]]; then
    if file_exists_path "$value"; then
      printf "%s" "$value"
      return 0
    fi
    return 1
  fi

  local candidates=(
    "$PWD/$value"
    "$HOME/$value"
    "/root/$value"
    "/$value"
  )
  local candidate=""
  for candidate in "${candidates[@]}"; do
    if file_exists_path "$candidate"; then
      printf "%s" "$candidate"
      return 0
    fi
  done
  return 1
}

clear_mirror_values() {
  MIRROR_NODESOURCE=""
  MIRROR_APT_EXTRA=""
  MIRROR_NPM=""
}

configure_mirrors_menu() {
  while true; do
    clear
    show_banner
    printf "\n"
    printf "Configure Mirrors\n"
    printf $'1) 🔗  Set NodeSource mirror (current: %s)\n' "${MIRROR_NODESOURCE:-<default>}"
    printf $'2) 🔗  Set apt mirror source (current: %s)\n' "${MIRROR_APT_EXTRA:-<none>}"
    printf $'3) 🔗  Set npm registry mirror (current: %s)\n' "${MIRROR_NPM:-<default>}"
    printf $'4) 🔄️  Restore defaults (clear mirrors)\n'
    printf $'5) ↩️  Go back\n\n'

    prompt_read "Choose an option [1-5]: " choice
    case "$choice" in
      1)
        local val=""
        prompt_read "NodeSource mirror base URL (blank to clear): " val
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"
        MIRROR_NODESOURCE="$val"
        ;;
      2)
        local val=""
        prompt_read "Extra apt source line for packages (blank to clear): " val
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"
        MIRROR_APT_EXTRA="$val"
        ;;
      3)
        local val=""
        prompt_read "npm registry mirror URL (blank to clear): " val
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"
        MIRROR_NPM="$val"
        ;;
      4)
        clear_mirror_values
        ;;
      5) return ;;
      *) printf "Invalid choice. Select a number from 1 to 5.\n" ;;
    esac
  done
}

prompt_source_mode() {
  local mode=""
  while true; do
    printf "\nSource Mode\n"
    printf "1) GitHub\n"
    printf "2) Offline\n"
    prompt_read "Choose an option [1-2]: " mode
    mode="${mode#"${mode%%[![:space:]]*}"}"
    mode="${mode%"${mode##*[![:space:]]}"}"
    case "$mode" in
      1)
        SOURCE_MODE="github"
        break
        ;;
      2)
        SOURCE_MODE="offline"
        break
        ;;
      *) printf "Choose 1 or 2.\n" ;;
    esac
  done
}

prompt_deploy_mode() {
  local mode=""
  while true; do
    printf "\nDeploy Mode\n"
    printf "1) Domain\n"
    printf "2) IP\n"
    prompt_read "Choose an option [1-2]: " mode
    mode="${mode#"${mode%%[![:space:]]*}"}"
    mode="${mode%"${mode##*[![:space:]]}"}"
    case "$mode" in
      1)
        DEPLOY_MODE="domain"
        break
        ;;
      2)
        DEPLOY_MODE="ip"
        break
        ;;
      *) printf "Choose 1 or 2.\n" ;;
    esac
  done
}

prompt_cert_mode() {
  local mode=""
  while true; do
    local option_one_label="Obtain certificate"
    if [[ "$DEPLOY_MODE" == "domain" ]]; then
      option_one_label="Obtain cert for domain"
    else
      option_one_label="Obtain 6-day cert for IP"
    fi
    printf "\nCertificate Mode\n"
    printf "1) %s\n" "$option_one_label"
    printf "2) TLS certificate files\n"
    printf "3) HTTP only\n"
    prompt_read "Choose an option [1-3]: " mode
    mode="${mode#"${mode%%[![:space:]]*}"}"
    mode="${mode%"${mode##*[![:space:]]}"}"
    case "$mode" in
      1)
        CERT_MODE="certbot"
        break
        ;;
      2)
        CERT_MODE="files"
        break
        ;;
      3)
        CERT_MODE="http"
        break
        ;;
      *) printf "Choose 1, 2, or 3.\n" ;;
    esac
  done
}

prompt_backup_zip_path() {
  local backup_input=""
  while true; do
    prompt_read "Enter the full path to the backup .zip file: " backup_input
    if [[ -z "$backup_input" ]]; then
      printf "Please provide a file path.\n"
      continue
    fi
    local resolved=""
    resolved="$(resolve_file_path "$backup_input")" || resolved=""
    if [[ -z "$resolved" ]]; then
      printf "File not found. Tried: %s\n" "$backup_input"
      continue
    fi
    if [[ "${resolved,,}" != *.zip ]]; then
      printf "Backup file must be a .zip archive.\n"
      continue
    fi
    printf "%s" "$resolved"
    return 0
  done
}

select_backup_zip_path() {
  local use_detected=""
  local detected=""
  detected="$(find_restore_backup_zip)" || detected=""
  if [[ -n "$detected" ]]; then
    use_detected="$(prompt_yes_no "Use detected backup zip ${detected}?" "yes")"
    if [[ "$use_detected" == "yes" ]]; then
      printf "%s" "$detected"
      return 0
    fi
  fi

  prompt_backup_zip_path
}

prompt_install_backup_restore() {
  DB_BACKUP_PATH=""
  DB_BACKUP_PASSWORD=""
  if [[ "$(prompt_yes_no "Restore database from a backup zip during installation?" "no")" != "yes" ]]; then
    return 0
  fi

  DB_BACKUP_PATH="$(select_backup_zip_path)"
  DB_BACKUP_PASSWORD="$(prompt_secret_optional "Backup password (leave blank if not encrypted)")"
  return 0
}

validate_backup_zip() {
  local zip_path="$1"
  local listing
  listing="$(run_as_root_output unzip -Z1 "$zip_path" 2>/dev/null || true)"
  if [[ -z "$listing" ]]; then
    printf "Backup zip appears empty or unreadable.\n"
    return 1
  fi
  if ! echo "$listing" | grep -qE '(^|/)data/songbird\.db$|(^|/)(songbird\.db)$'; then
    printf "Backup zip missing songbird.db.\n"
    return 1
  fi
  if ! echo "$listing" | grep -qE '(^|/)data/uploads(/|$)|(^|/)uploads(/|$)'; then
    printf "Backup zip missing uploads/ directory.\n"
    return 1
  fi
  return 0
}

zip_contains_data_dir() {
  local zip_path="$1"
  local listing
  listing="$(run_as_root_output unzip -Z1 "$zip_path" 2>/dev/null || true)"
  if [[ -z "$listing" ]]; then
    return 1
  fi
  echo "$listing" | grep -qE '(^|/)data(/|$)'
}

prepare_source_root_for_data_copy() {
  local zip_path="$1"
  local source_root="$2"
  local action_label="$3"

  if ! zip_contains_data_dir "$zip_path"; then
    return 0
  fi

  if [[ "$(prompt_yes_no "Source zip includes data/. Replace ${INSTALL_DIR}/data during ${action_label}?" "no")" != "yes" ]]; then
    log "Keeping existing data/. Skipping data/ from source zip."
    if [[ -d "$source_root/data" ]]; then
      run_silent run_as_root rm -rf "$source_root/data"
    fi
  fi
}

extract_backup_zip() {
  local zip_path="$1"
  local tmp_dir="$2"
  local password="${3:-}"
  EXTRACT_SOURCE_DIR=""
  EXTRACT_ENV_SRC=""

  if [[ -n "$password" ]]; then
    run_unzip_capture unzip -P "$password" -q "$zip_path" -d "$tmp_dir" || return 1
  else
    run_unzip_capture unzip -q "$zip_path" -d "$tmp_dir" || return 1
  fi

  local source_dir="$tmp_dir"
  local env_src="$tmp_dir/.env"
  if [[ -d "$tmp_dir/data" ]]; then
    source_dir="$tmp_dir/data"
  fi

  local db_src="$source_dir/songbird.db"
  local uploads_src="$source_dir/uploads"

  if [[ ! -f "$db_src" || ! -d "$uploads_src" ]]; then
    return 1
  fi

  if [[ ! -f "$env_src" && -f "$source_dir/.env" ]]; then
    env_src="$source_dir/.env"
  fi

  EXTRACT_SOURCE_DIR="$source_dir"
  EXTRACT_ENV_SRC="$env_src"
  return 0
}

detect_os() {
  [[ -f /etc/os-release ]] || fail "Cannot detect OS (/etc/os-release missing)."
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_ID_LIKE="${ID_LIKE:-}"

  if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_ID_LIKE" == *"debian"* ]]; then
    return 0
  fi
  fail "Unsupported OS: ${PRETTY_NAME:-unknown}. This script supports Debian/Ubuntu only."
}

ensure_sudo() {
  if [[ "$EUID" -ne 0 ]]; then
    have_cmd sudo || fail "This script needs root privileges. Install sudo or run as root."
    SUDO="sudo"
    $SUDO -v
  fi
}

install_required_packages() {
  local required_pkgs=(
    git
    curl
    ca-certificates
    gnupg
    lsb-release
    build-essential
    nginx
    ffmpeg
    nano
    zip
    unzip
  )
  if [[ "$TURN_ENABLED" == "true" ]]; then
    required_pkgs+=(coturn)
  fi
  if [[ "$CERT_MODE" == "certbot" && "$DEPLOY_MODE" == "domain" ]]; then
    required_pkgs+=(certbot)
  fi
  local missing_pkgs=()
  local pkg=""

  for pkg in "${required_pkgs[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      missing_pkgs+=("$pkg")
    fi
  done

  local codename=$(lsb_release -sc)
  if [[ -n "$MIRROR_APT_EXTRA" ]]; then
    log "Refreshing apt package index (temporary mirror: ${MIRROR_APT_EXTRA})..."
    run_silent run_as_root apt-get update \
      -o Dir::Etc::sourcelist=/dev/null \
      -o Dir::Etc::sourceparts=/dev/null \
      -o Dir::Etc::sourcelist=- \
      -o Dir::Etc::sourceparts=- <<EOF
deb ${MIRROR_APT_EXTRA} ${codename} main restricted universe multiverse
EOF
    [[ "$?" -eq 0 ]] || fail "Failed to refresh apt package index from mirror."
  else
    log "Refreshing apt package index..."
    run_silent run_as_root apt-get update || fail "Failed to refresh apt package index."
  fi

  if (( ${#missing_pkgs[@]} > 0 )); then
    log "Installing missing packages: ${missing_pkgs[*]}"
    run_silent run_as_root apt-get install -y --allow-downgrades "${missing_pkgs[@]}" || fail "Failed to install required packages."
  else
    log "All required base packages are already installed."
  fi
}

ensure_nodejs_from_nodesource() {
  if command -v node &>/dev/null; then
    local current_major
    current_major="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
    if (( current_major >= NODE_MAJOR )); then
      log "Node.js ${current_major}.x already installed. Skipping."
      return 0
    fi
  fi

  if [[ -n "$MIRROR_NODESOURCE" ]]; then
    # Detect tarball vs setup-script mirror by checking for .tar.gz suffix
    if [[ "$MIRROR_NODESOURCE" == *.tar.gz ]]; then
      log "Installing Node.js from tarball mirror: ${MIRROR_NODESOURCE}"

      local tmp_dir
      tmp_dir="$(mktemp -d)"
      local tarball="${tmp_dir}/node.tar.gz"

      curl -fsSL "$MIRROR_NODESOURCE" -o "$tarball"

      local install_dir="/usr/local"
      run_silent run_as_root tar -xzf "$tarball" -C "$install_dir" --strip-components=1

      rm -rf "$tmp_dir"

      log "Node.js installed from tarball to ${install_dir}."
      return 0
    else
      # NodeSource-compatible mirror: mirror base URL + /setup_XX.x
      local setup_url="${MIRROR_NODESOURCE%/}/setup_${NODE_MAJOR}.x"
      log "Installing Node.js ${NODE_MAJOR}.x via NodeSource-style mirror: ${setup_url}"
      if [[ -n "$SUDO" ]]; then
        curl -fsSL "$setup_url" | $SUDO -E bash -
      else
        curl -fsSL "$setup_url" | bash -
      fi
      run_silent run_as_root apt-get install -y nodejs
      return 0
    fi
  fi

  # Default: official NodeSource
  local setup_url="https://deb.nodesource.com/setup_${NODE_MAJOR}.x"
  log "Installing Node.js ${NODE_MAJOR}.x via NodeSource..."
  if [[ -n "$SUDO" ]]; then
    curl -fsSL "$setup_url" | $SUDO -E bash -
  else
    curl -fsSL "$setup_url" | bash -
  fi
  run_silent run_as_root apt-get install -y nodejs
}

resolve_node_exec_path() {
  local node_path=""
  if have_cmd node; then
    node_path="$(command -v node)"
  elif have_cmd nodejs; then
    node_path="$(command -v nodejs)"
  fi

  if [[ -z "$node_path" ]]; then
    fail "Node.js executable not found in PATH after installation."
  fi

  NODE_EXEC_PATH="$node_path"
  log "Using Node.js executable for systemd service: ${NODE_EXEC_PATH}"
}


ensure_service_user_exists() {
  if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    log "Creating dedicated system user: ${SERVICE_USER}"
    run_silent run_as_root useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  fi
}

map_lego_arch() {
  local machine=""
  machine="$(uname -m)"
  case "$machine" in
    x86_64|amd64) printf "amd64" ;;
    aarch64|arm64) printf "arm64" ;;
    armv7l|armv7) printf "armv7" ;;
    armv6l|armv6) printf "armv6" ;;
    i386|i686) printf "386" ;;
    *) fail "Unsupported architecture for lego binary install: ${machine}" ;;
  esac
}

lego_supports_shortlived_profile() {
  [[ -x "$LEGO_BIN" ]] || return 1
  local help_text=""
  help_text="$("$LEGO_BIN" run --help 2>&1 || true)"
  [[ "$help_text" == *"--profile"* ]]
}

ensure_lego_installed() {
  if [[ -x "$LEGO_BIN" ]]; then
    if lego_supports_shortlived_profile; then
      log "lego binary already installed at ${LEGO_BIN}."
      return 0
    fi
    warn "Existing lego binary at ${LEGO_BIN} does not support --profile; upgrading."
  fi

  local latest_url=""
  latest_url="$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/go-acme/lego/releases/latest)" || {
    fail "Unable to resolve latest lego release URL."
  }
  local latest_tag="${latest_url##*/}"
  [[ -n "$latest_tag" ]] || fail "Unable to determine latest lego release tag."

  local arch=""
  arch="$(map_lego_arch)"
  local asset="lego_${latest_tag}_linux_${arch}.tar.gz"
  local download_url="https://github.com/go-acme/lego/releases/download/${latest_tag}/${asset}"
  local tmp_dir=""
  tmp_dir="$(mktemp -d)"

  log "Downloading lego ${latest_tag} for linux/${arch}..."
  curl -fsSL "$download_url" -o "${tmp_dir}/${asset}" || {
    run_silent run_as_root rm -rf "$tmp_dir"
    fail "Unable to download lego binary from ${download_url}"
  }

  run_silent run_as_root tar -xzf "${tmp_dir}/${asset}" -C "$tmp_dir"
  run_silent run_as_root install -m 755 "${tmp_dir}/lego" "$LEGO_BIN"
  run_silent run_as_root rm -rf "$tmp_dir"
  log "Installed lego at ${LEGO_BIN}."

  lego_supports_shortlived_profile || fail "Installed lego at ${LEGO_BIN} does not support --profile. Please verify the binary and try again."
}

clone_repo() {
  run_silent run_as_root mkdir -p "$INSTALL_DIR"

  if run_as_root test -d "$INSTALL_DIR/.git"; then
    log "Repository exists at ${INSTALL_DIR}. Updating source..."
    run_in_install_dir "git fetch --all --prune"
    run_in_install_dir "git checkout master"
    run_in_install_dir "git pull --ff-only origin master"
    return 0
  fi

  if dir_has_entries "$INSTALL_DIR"; then
    if [[ "$(prompt_yes_no "${INSTALL_DIR} exists and is not empty. Delete it and re-clone from GitHub?" "no")" != "yes" ]]; then
      warn "Installation canceled. Clear ${INSTALL_DIR} or use offline mode."
      return 1
    fi
    run_as_root rm -rf "$INSTALL_DIR"
    run_silent run_as_root mkdir -p "$INSTALL_DIR"
  fi

  log "Cloning BirdX repository..."
  run_silent run_as_root git clone "$REPO_URL" "$INSTALL_DIR"
}

prepare_install_dir_for_offline() {
  run_silent run_as_root mkdir -p "$INSTALL_DIR"
  if dir_has_entries "$INSTALL_DIR"; then
    warn "${INSTALL_DIR} is not empty. Clear it before installation."
    press_enter_to_continue
    return 1
  fi
  return 0
}

find_offline_source_zip() {
  local zip_name="birdx.zip"
  local legacy_zip_name="songbird.zip"
  local candidates=(
    "$HOME/${zip_name}"
    "/root/${zip_name}"
    "/${zip_name}"
    "$HOME/${legacy_zip_name}"
    "/root/${legacy_zip_name}"
    "/${legacy_zip_name}"
  )
  local candidate=""
  for candidate in "${candidates[@]}"; do
    if file_exists_path "$candidate"; then
      printf "%s" "$candidate"
      return 0
    fi
  done
  return 1
}

find_restore_backup_zip() {
  local candidates=(
    "/opt/birdx/data/backups"
    "/root"
  )
  local dir=""
  for dir in "${candidates[@]}"; do
    local found=""
    found="$(run_as_root_output bash -lc "find '$dir' -maxdepth 1 -type f -name 'songbird-backup-*.zip' -printf '%T@\t%p\n' 2>/dev/null | sort -nr | head -1 | cut -f2-" | tr -d '\r\n')" || found=""
    if [[ -n "$found" && -f "$found" ]]; then
      printf "%s" "$found"
      return 0
    fi
  done
  return 1
}

resolve_offline_source_root() {
  local tmp_dir="$1"
  if [[ -f "$tmp_dir/package.json" && -d "$tmp_dir/server" && -d "$tmp_dir/client" ]]; then
    printf "%s" "$tmp_dir"
    return 0
  fi
  local entry_count
  entry_count="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d '[:space:]')"
  if [[ "$entry_count" -eq 1 ]]; then
    local only_dir
    only_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
    if [[ -f "$only_dir/package.json" && -d "$only_dir/server" && -d "$only_dir/client" ]]; then
      printf "%s" "$only_dir"
      return 0
    fi
  fi
  return 1
}

ensure_offline_source_ready() {
  local mode_label="$1"
  local zip_path=""
  zip_path="$(find_offline_source_zip)" || zip_path=""
  if [[ -z "$zip_path" ]]; then
    warn "Offline ${mode_label} requires /birdx.zip to be available at the filesystem root. Legacy /songbird.zip is also accepted."
    press_enter_to_continue
    return 1
  fi
  SOURCE_ZIP_PATH="$zip_path"
  return 0
}

extract_offline_source_zip() {
  local zip_path="$1"
  local mode_label="$2"
  have_cmd unzip || fail "unzip is required for offline ${mode_label}s. Install it first and retry."

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  run_silent run_as_root unzip -q "$zip_path" -d "$tmp_dir"

  local source_root
  source_root="$(resolve_offline_source_root "$tmp_dir")" || {
    run_silent run_as_root rm -rf "$tmp_dir"
    fail "Source zip does not appear to contain BirdX (missing server/client/package.json)."
  }

  printf "%s|%s" "$tmp_dir" "$source_root"
}

read_version_value() {
  local version_file="$1"
  if [[ ! -f "$version_file" ]]; then
    return 1
  fi
  local version=""
  version="$(head -n 1 "$version_file" | tr -d '\r\n' | xargs)"
  if [[ -z "$version" ]]; then
    return 1
  fi
  printf "%s" "$version"
}

offline_source_is_newer() {
  local source_root="$1"
  local install_root="$2"

  local source_version_file="$source_root/VERSION"
  local install_version_file="$install_root/VERSION"
  local source_version=""
  local install_version=""

  source_version="$(read_version_value "$source_version_file")" || {
    warn "Offline source is missing VERSION. Skipping update."
    return 1
  }

  install_version="$(read_version_value "$install_version_file")" || install_version=""
  if [[ -z "$install_version" ]]; then
    log "Installed app is missing VERSION. Treating offline source ${source_version} as newer."
    return 0
  fi

  if dpkg --compare-versions "$source_version" gt "$install_version"; then
    log "Offline source version ${source_version} is newer than installed version ${install_version}."
    return 0
  fi

  log "Offline source version ${source_version} is not newer than installed version ${install_version}."
  return 1
}

install_source_from_zip() {
  local zip_path="$1"
  prepare_install_dir_for_offline || return 1
  local extract_result=""
  extract_result="$(extract_offline_source_zip "$zip_path" "install")"
  local tmp_dir="${extract_result%%|*}"
  local source_root="${extract_result#*|}"

  prepare_source_root_for_data_copy "$zip_path" "$source_root" "install"

  run_silent run_as_root cp -a "$source_root"/. "$INSTALL_DIR"/
  if [[ -f "$source_root/.env.example" ]]; then
    run_silent run_as_root cp -a "$source_root/.env.example" "$INSTALL_DIR/.env.example"
  fi
  apply_ownership
  run_silent run_as_root rm -rf "$tmp_dir"
  return 0
}

update_source_from_zip() {
  local zip_path="$1"
  local extract_result=""
  extract_result="$(extract_offline_source_zip "$zip_path" "update")"
  local tmp_dir="${extract_result%%|*}"
  local source_root="${extract_result#*|}"

  prepare_source_root_for_data_copy "$zip_path" "$source_root" "update"

  run_silent run_as_root cp -a "$source_root"/. "$INSTALL_DIR"/
  if [[ -f "$source_root/.env.example" ]]; then
    run_silent run_as_root cp -a "$source_root/.env.example" "$INSTALL_DIR/.env.example"
  fi
  apply_ownership
  run_silent run_as_root rm -rf "$tmp_dir"
}

install_birdx_dependencies() {
  local npm_registry_arg=""
  if [[ -n "$MIRROR_NPM" ]]; then
    npm_registry_arg="--registry $(printf "%q" "$MIRROR_NPM")"
  fi

  log "Installing server dependencies..."
  run_in_install_dir "npm --prefix server ${npm_registry_arg} install" || fail "Failed to install server dependencies."

  log "Installing client dependencies..."
  run_in_install_dir "npm --prefix client ${npm_registry_arg} install" || fail "Failed to install client dependencies."

  log "Building client..."
  run_in_install_dir "npm --prefix client run build" || fail "Failed to build client assets."
}

get_existing_env_value() {
  local key="$1"
  local default="$2"
  local env_file="$INSTALL_DIR/.env"
  if [[ ! -f "$env_file" ]]; then
    printf "%s" "$default"
    return 0
  fi
  local existing
  existing="$(grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d "=" -f 2- || true)"
  if [[ -z "$existing" ]]; then
    printf "%s" "$default"
  else
    printf "%s" "$existing"
  fi
}

get_existing_env_value_with_fallback() {
  local primary="$1"
  local fallback="$2"
  local default="$3"
  local env_file="$INSTALL_DIR/.env"
  if [[ ! -f "$env_file" ]]; then
    printf "%s" "$default"
    return 0
  fi
  local existing
  existing="$(grep -E "^${primary}=" "$env_file" | tail -n 1 | cut -d "=" -f 2- || true)"
  if [[ -n "$existing" ]]; then
    printf "%s" "$existing"
    return 0
  fi
  if [[ -n "$fallback" ]]; then
    existing="$(grep -E "^${fallback}=" "$env_file" | tail -n 1 | cut -d "=" -f 2- || true)"
    if [[ -n "$existing" ]]; then
      printf "%s" "$existing"
      return 0
    fi
  fi
  printf "%s" "$default"
}

replace_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="$(printf '%s' "$value" | sed 's/[&/]/\\&/g')"
  if grep -qE "^${key}=" "$env_file"; then
    run_silent run_as_root sed -i "s|^${key}=.*|${key}=${escaped}|" "$env_file"
  else
    run_silent run_as_root bash -lc "printf '%s\n' '${key}=${escaped}' >> '$env_file'"
  fi
}

write_env_from_example() {
  local env_file="${INSTALL_DIR}/.env"
  local example_file="${INSTALL_DIR}/.env.example"
  if [[ ! -f "$example_file" ]]; then
    log "Missing ${example_file}. Falling back to minimal .env defaults."
    write_env_fallback "$env_file"
    CURRENT_ENV_FILE="$env_file"
    return 0
  fi
  local existing_public_key
  local existing_private_key
  local existing_subject
  local existing_server_port
  local existing_client_port
  local existing_voice_waveform_max_decode_bytes
  local existing_voice_waveform_max_decode_seconds
  local existing_storage_encryption_key
  local existing_file_upload_hard_max_size
  local existing_remote_channel
  local existing_remote_channel_api_id
  local existing_remote_channel_api_hash
  local existing_remote_channel_session_string
  local existing_remote_channel_proxy_url
  local existing_turn_urls
  local existing_turn_username
  local existing_turn_credential
  existing_public_key="$(get_existing_env_value "VAPID_PUBLIC_KEY" "")"
  existing_private_key="$(get_existing_env_value "VAPID_PRIVATE_KEY" "")"
  existing_subject="$(get_existing_env_value "VAPID_SUBJECT" "mailto:admin@example.com")"
  existing_server_port="$(get_existing_env_value_with_fallback "SERVER_PORT" "PORT" "$DEFAULT_SERVER_PORT")"
  existing_client_port="$(get_existing_env_value "CLIENT_PORT" "$DEFAULT_CLIENT_PORT")"
  existing_voice_waveform_max_decode_bytes="$(get_existing_env_value "CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES" "$DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES")"
  existing_voice_waveform_max_decode_seconds="$(get_existing_env_value "CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS" "$DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS")"
  existing_storage_encryption_key="$(get_existing_env_value "STORAGE_ENCRYPTION_KEY" "")"
  existing_file_upload_hard_max_size="$(get_existing_env_value "FILE_UPLOAD_HARD_MAX_SIZE" "1073741824")"
  existing_remote_channel="$(get_existing_env_value "REMOTE_CHANNEL" "false")"
  existing_remote_channel_api_id="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_ID" "0")"
  existing_remote_channel_api_hash="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_HASH" "")"
  existing_remote_channel_session_string="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_SESSION_STRING" "")"
  existing_remote_channel_proxy_url="$(get_existing_env_value "REMOTE_CHANNEL_PROXY_URL" "")"
  existing_turn_urls="$(get_existing_env_value_with_fallback "APP_TURN_URLS" "CHAT_TURN_URLS" "")"
  existing_turn_username="$(get_existing_env_value_with_fallback "APP_TURN_USERNAME" "CHAT_TURN_USERNAME" "")"
  existing_turn_credential="$(get_existing_env_value_with_fallback "APP_TURN_CREDENTIAL" "CHAT_TURN_CREDENTIAL" "")"

  run_silent run_as_root cp "$example_file" "$env_file"
  replace_env_value "$env_file" "SERVER_PORT" "$existing_server_port"
  replace_env_value "$env_file" "CLIENT_PORT" "$existing_client_port"
  replace_env_value "$env_file" "SERVER_PORT" "$SERVER_PORT"
  replace_env_value "$env_file" "CLIENT_PORT" "$CLIENT_PORT"
  replace_env_value "$env_file" "ACCOUNT_CREATION" "$ACCOUNT_CREATION"
  replace_env_value "$env_file" "FILE_UPLOAD" "$FILE_UPLOAD"
  replace_env_value "$env_file" "FILE_UPLOAD_HARD_MAX_SIZE" "$existing_file_upload_hard_max_size"
  replace_env_value "$env_file" "FILE_UPLOAD_MAX_TOTAL_SIZE" "$MAX_UPLOAD"
  replace_env_value "$env_file" "MESSAGE_FILE_RETENTION" "$RETENTION_DAYS"
  replace_env_value "$env_file" "MESSAGE_TEXT_RETENTION" "$TEXT_RETENTION_DAYS"
  replace_env_value "$env_file" "REMOTE_CHANNEL" "$existing_remote_channel"
  replace_env_value "$env_file" "REMOTE_CHANNEL_TELEGRAM_API_ID" "$existing_remote_channel_api_id"
  replace_env_value "$env_file" "REMOTE_CHANNEL_TELEGRAM_API_HASH" "$existing_remote_channel_api_hash"
  replace_env_value "$env_file" "REMOTE_CHANNEL_TELEGRAM_SESSION_STRING" "$existing_remote_channel_session_string"
  replace_env_value "$env_file" "REMOTE_CHANNEL_PROXY_URL" "$existing_remote_channel_proxy_url"
  replace_env_value "$env_file" "REMOTE_CHANNEL_POLL_INTERVAL_MS" "$(get_existing_env_value "REMOTE_CHANNEL_POLL_INTERVAL_MS" "5000")"
  replace_env_value "$env_file" "REMOTE_CHANNEL_TELEGRAM_POLL_LIMIT" "$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_POLL_LIMIT" "50")"
  replace_env_value "$env_file" "REMOTE_CHANNEL_QUEUE_INTERVAL_MS" "$(get_existing_env_value "REMOTE_CHANNEL_QUEUE_INTERVAL_MS" "1000")"
  replace_env_value "$env_file" "REMOTE_CHANNEL_QUEUE_MAX_ATTEMPTS" "$(get_existing_env_value "REMOTE_CHANNEL_QUEUE_MAX_ATTEMPTS" "10")"
  replace_env_value "$env_file" "REMOTE_CHANNEL_QUEUE_STALE_LOCK_MS" "$(get_existing_env_value "REMOTE_CHANNEL_QUEUE_STALE_LOCK_MS" "300000")"
  replace_env_value "$env_file" "CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES" "$existing_voice_waveform_max_decode_bytes"
  replace_env_value "$env_file" "CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS" "$existing_voice_waveform_max_decode_seconds"
  replace_env_value "$env_file" "STORAGE_ENCRYPTION_KEY" "$existing_storage_encryption_key"
  replace_env_value "$env_file" "VAPID_PUBLIC_KEY" "$existing_public_key"
  replace_env_value "$env_file" "VAPID_PRIVATE_KEY" "$existing_private_key"
  replace_env_value "$env_file" "APP_TURN_URLS" "$existing_turn_urls"
  replace_env_value "$env_file" "APP_TURN_USERNAME" "$existing_turn_username"
  replace_env_value "$env_file" "APP_TURN_CREDENTIAL" "$existing_turn_credential"
  apply_turn_env_settings "$env_file"
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    replace_env_value "$env_file" "VAPID_SUBJECT" "mailto:${CERTBOT_EMAIL}"
  else
    replace_env_value "$env_file" "VAPID_SUBJECT" "$existing_subject"
  fi
  CURRENT_ENV_FILE="$env_file"
  log "Wrote environment config from ${example_file}."
}

write_env_fallback() {
  local env_file="$1"
  local existing_storage_encryption_key
  local existing_public_key
  local existing_private_key
  local existing_subject
  local existing_file_upload_hard_max_size
  local existing_remote_channel
  local existing_remote_channel_api_id
  local existing_remote_channel_api_hash
  local existing_remote_channel_session_string
  local existing_remote_channel_proxy_url
  local existing_turn_urls
  local existing_turn_username
  local existing_turn_credential
  existing_storage_encryption_key="$(get_existing_env_value "STORAGE_ENCRYPTION_KEY" "")"
  existing_public_key="$(get_existing_env_value "VAPID_PUBLIC_KEY" "")"
  existing_private_key="$(get_existing_env_value "VAPID_PRIVATE_KEY" "")"
  existing_subject="$(get_existing_env_value "VAPID_SUBJECT" "mailto:admin@example.com")"
  existing_file_upload_hard_max_size="$(get_existing_env_value "FILE_UPLOAD_HARD_MAX_SIZE" "1073741824")"
  existing_remote_channel="$(get_existing_env_value "REMOTE_CHANNEL" "false")"
  existing_remote_channel_api_id="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_ID" "0")"
  existing_remote_channel_api_hash="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_HASH" "")"
  existing_remote_channel_session_string="$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_SESSION_STRING" "")"
  existing_remote_channel_proxy_url="$(get_existing_env_value "REMOTE_CHANNEL_PROXY_URL" "")"
  existing_turn_urls="$(get_existing_env_value_with_fallback "APP_TURN_URLS" "CHAT_TURN_URLS" "")"
  existing_turn_username="$(get_existing_env_value_with_fallback "APP_TURN_USERNAME" "CHAT_TURN_USERNAME" "")"
  existing_turn_credential="$(get_existing_env_value_with_fallback "APP_TURN_CREDENTIAL" "CHAT_TURN_CREDENTIAL" "")"
  run_silent run_as_root bash -lc "cat > '$env_file' <<'EOF'
SERVER_PORT=${SERVER_PORT}
CLIENT_PORT=${CLIENT_PORT}
APP_ENV=production
APP_DEBUG=false
ACCOUNT_CREATION=${ACCOUNT_CREATION}
FILE_UPLOAD=${FILE_UPLOAD}
FILE_UPLOAD_MAX_SIZE=26214400
FILE_UPLOAD_HARD_MAX_SIZE=${existing_file_upload_hard_max_size}
FILE_UPLOAD_MAX_TOTAL_SIZE=${MAX_UPLOAD}
FILE_UPLOAD_MAX_FILES=10
FILE_UPLOAD_TRANSCODE_VIDEOS=true
MESSAGE_FILE_RETENTION=${RETENTION_DAYS}
MESSAGE_TEXT_RETENTION=${TEXT_RETENTION_DAYS}
MESSAGE_MAX_CHARS=4000
REMOTE_CHANNEL=${existing_remote_channel}
REMOTE_CHANNEL_TELEGRAM_API_ID=${existing_remote_channel_api_id}
REMOTE_CHANNEL_TELEGRAM_API_HASH=${existing_remote_channel_api_hash}
REMOTE_CHANNEL_TELEGRAM_SESSION_STRING=${existing_remote_channel_session_string}
REMOTE_CHANNEL_PROXY_URL=${existing_remote_channel_proxy_url}
REMOTE_CHANNEL_POLL_INTERVAL_MS=5000
REMOTE_CHANNEL_TELEGRAM_POLL_LIMIT=50
REMOTE_CHANNEL_QUEUE_INTERVAL_MS=1000
REMOTE_CHANNEL_QUEUE_MAX_ATTEMPTS=10
REMOTE_CHANNEL_QUEUE_STALE_LOCK_MS=300000
CHAT_PENDING_TEXT_TIMEOUT=300000
CHAT_PENDING_FILE_TIMEOUT=1200000
CHAT_PENDING_RETRY_INTERVAL=4000
CHAT_PENDING_STATUS_CHECK_INTERVAL=1000
CHAT_CACHE_TTL=24
CHAT_MESSAGE_FETCH_LIMIT=300
CHAT_MESSAGE_PAGE_SIZE=60
CHAT_LIST_REFRESH_INTERVAL=20000
CHAT_PRESENCE_PING_INTERVAL=5000
CHAT_PEER_PRESENCE_POLL_INTERVAL=3000
CHAT_HEALTH_CHECK_INTERVAL=10000
CHAT_SSE_RECONNECT_DELAY=2000
CHAT_SEARCH_MAX_RESULTS=5
CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES=${DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_BYTES}
CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS=${DEFAULT_CHAT_VOICE_WAVEFORM_MAX_DECODE_SECONDS}
APP_TURN_URLS=${existing_turn_urls}
APP_TURN_USERNAME=${existing_turn_username}
APP_TURN_CREDENTIAL=${existing_turn_credential}
NICKNAME_MAX=24
USERNAME_MAX=16
STORAGE_ENCRYPTION_KEY=${existing_storage_encryption_key}
VAPID_PUBLIC_KEY=${existing_public_key}
VAPID_PRIVATE_KEY=${existing_private_key}
VAPID_SUBJECT=${existing_subject}
EOF"
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    replace_env_value "$env_file" "VAPID_SUBJECT" "mailto:${CERTBOT_EMAIL}"
  fi
  apply_turn_env_settings "$env_file"
  log "Wrote fallback environment config to ${env_file}."
}

ensure_vapid_keys() {
  local env_file="${INSTALL_DIR}/.env"
  local public_key
  local private_key
  public_key="$(get_existing_env_value "VAPID_PUBLIC_KEY" "")"
  private_key="$(get_existing_env_value "VAPID_PRIVATE_KEY" "")"
  if [[ -n "$public_key" && -n "$private_key" ]]; then
    log "VAPID keys already present. Skipping generation."
    return 0
  fi
  log "Generating VAPID keys..."
  local keys
  keys="$(run_as_root_output bash -lc "cd '$INSTALL_DIR/server' && node --input-type=module -e \"import pkg from 'web-push'; const { generateVAPIDKeys } = pkg; const k = generateVAPIDKeys(); console.log(k.publicKey); console.log(k.privateKey);\"")" || {
    warn "Failed to generate VAPID keys. Make sure server dependencies are installed."
    return 1
  }
  local new_public=""
  local new_private=""
  IFS=$'\n' read -r new_public new_private _ <<< "$keys"
  if [[ -z "$new_public" || -z "$new_private" ]]; then
    return 1
  fi
  replace_env_value "$env_file" "VAPID_PUBLIC_KEY" "$new_public"
  replace_env_value "$env_file" "VAPID_PRIVATE_KEY" "$new_private"
  log "VAPID keys generated and saved to ${env_file}."
}

open_env_editor() {
  local env_file="$1"
  local editor_cmd="${EDITOR:-nano}"
  if ! have_cmd "$editor_cmd"; then
    editor_cmd="vi"
  fi

  log "Opening ${env_file} with ${editor_cmd}. Save and close to continue."

  if [[ -n "$SUDO" ]]; then
    $SUDO -t "$editor_cmd" "$env_file"
  else
    "$editor_cmd" "$env_file"
  fi

  clear
}

sync_values_from_env() {
  local env_file="$INSTALL_DIR/.env"
  SERVER_PORT="$(get_existing_env_value_with_fallback "SERVER_PORT" "PORT" "$DEFAULT_SERVER_PORT")"
  CLIENT_PORT="$(get_existing_env_value "CLIENT_PORT" "$DEFAULT_CLIENT_PORT")"
  FILE_UPLOAD="$(get_existing_env_value "FILE_UPLOAD" "$DEFAULT_FILE_UPLOAD")"
  MAX_UPLOAD="$(get_existing_env_value "FILE_UPLOAD_MAX_TOTAL_SIZE" "$DEFAULT_MAX_UPLOAD")"
  RETENTION_DAYS="$(get_existing_env_value "MESSAGE_FILE_RETENTION" "$DEFAULT_RETENTION_DAYS")"
  TEXT_RETENTION_DAYS="$(get_existing_env_value "MESSAGE_TEXT_RETENTION" "$DEFAULT_TEXT_RETENTION_DAYS")"
  ACCOUNT_CREATION="$(get_existing_env_value "ACCOUNT_CREATION" "$DEFAULT_ACCOUNT_CREATION")"
  CURRENT_ENV_FILE="$env_file"
}

parse_domain_input() {
  local raw="$1"
  DOMAIN_NAMES=()
  INVALID_DOMAIN_NAMES=()
  local IFS=','
  local d
  for d in $raw; do
    d="$(normalize_domain_name "$d")"
    if [[ -z "$d" ]]; then
      continue
    fi
    if is_valid_domain_name "$d"; then
      DOMAIN_NAMES+=("$d")
    else
      INVALID_DOMAIN_NAMES+=("$d")
    fi
  done
  NGINX_SERVER_NAME="${DOMAIN_NAMES[*]}"
}


collect_install_options() {
  prompt_deploy_mode

  if [[ "$DEPLOY_MODE" == "domain" ]]; then
    local raw_domains=""
    while true; do
      prompt_read "Enter your domain(s), comma-separated (e.g. example.com, www.example.com): " raw_domains
      raw_domains="${raw_domains#"${raw_domains%%[![:space:]]*}"}"
      raw_domains="${raw_domains%"${raw_domains##*[![:space:]]}"}"
      if [[ -n "$raw_domains" ]]; then
        parse_domain_input "$raw_domains"
        if (( ${#INVALID_DOMAIN_NAMES[@]} > 0 )); then
          printf "Invalid domain(s): %s\n" "${INVALID_DOMAIN_NAMES[*]}"
        elif (( ${#DOMAIN_NAMES[@]} > 0 )); then
          break
        fi
      fi
      printf "Please enter at least one domain.\n"
    done
  else
    NGINX_SERVER_NAME="_"
  fi

  prompt_cert_mode

  case "$CERT_MODE" in
    certbot)
      CERTBOT_EMAIL="$(prompt_non_empty "Enter email for Let's Encrypt renewal notices")"
      if [[ "$DEPLOY_MODE" == "ip" ]]; then
        CERTBOT_IP_ADDRESS="$(prompt_non_empty "Enter the public IP address for the TLS certificate")"
        NGINX_SERVER_NAME="$CERTBOT_IP_ADDRESS"
      fi
      ;;
    files)
      while true; do
        MANUAL_CERT_FULLCHAIN_PATH="$(prompt_non_empty "Enter path to fullchain.pem")"
        MANUAL_CERT_FULLCHAIN_PATH="$(resolve_file_path "$MANUAL_CERT_FULLCHAIN_PATH")" || MANUAL_CERT_FULLCHAIN_PATH=""
        if [[ -n "$MANUAL_CERT_FULLCHAIN_PATH" ]]; then
          break
        fi
        printf "Could not find that fullchain.pem file.\n"
      done
      while true; do
        MANUAL_CERT_PRIVKEY_PATH="$(prompt_non_empty "Enter path to privkey.pem")"
        MANUAL_CERT_PRIVKEY_PATH="$(resolve_file_path "$MANUAL_CERT_PRIVKEY_PATH")" || MANUAL_CERT_PRIVKEY_PATH=""
        if [[ -n "$MANUAL_CERT_PRIVKEY_PATH" ]]; then
          break
        fi
        printf "Could not find that privkey.pem file.\n"
      done
      ;;
  esac


  SERVER_PORT="$(prompt_port)"
  if [[ "$CERT_MODE" == "http" ]]; then
    CLIENT_PORT="$(prompt_client_port "$DEFAULT_CLIENT_PORT")"
  else
    while true; do
      CLIENT_PORT="$(prompt_client_port "443")"
      if [[ "$CLIENT_PORT" != "80" ]]; then
        break
      fi
      printf "HTTPS port cannot be 80 because port 80 is used for HTTP redirect and certificate checks.\n"
    done
  fi
  if [[ "$CERT_MODE" != "http" ]]; then
    log "Using HTTP redirect on port 80 and HTTPS on port ${CLIENT_PORT}."
  fi

  if [[ "$(prompt_yes_no "Allow account creation via website?" "yes")" == "yes" ]]; then
    ACCOUNT_CREATION="true"
  else
    ACCOUNT_CREATION="false"
  fi

  if [[ "$(prompt_yes_no "Enable file uploads?" "yes")" == "yes" ]]; then
    FILE_UPLOAD="true"
  else
    FILE_UPLOAD="false"
  fi

  if [[ "$FILE_UPLOAD" == "true" ]]; then
    RETENTION_DAYS="$(prompt_retention_days)"
  else
    RETENTION_DAYS="0"
  fi
  TEXT_RETENTION_DAYS="$(prompt_text_retention_days)"
  prompt_turn_options

}

write_full_env_with_defaults() {
  run_silent run_as_root mkdir -p "$INSTALL_DIR"
  write_env_from_example
}

apply_ownership() {
  ensure_service_user_exists
  run_silent run_as_root chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR"
  run_silent run_as_root git config --global --add safe.directory "$INSTALL_DIR"
}

ensure_runtime_layout() {
  log "Preparing runtime files and directories..."
  run_silent run_as_root mkdir -p \
    "$INSTALL_DIR/data/uploads/messages" \
    "$INSTALL_DIR/data/uploads/avatars" \
    "$INSTALL_DIR/data/backups" \
    "$INSTALL_DIR/logs" || fail "Failed to create BirdX runtime directories."

  run_silent run_as_root test -f "$INSTALL_DIR/server/index.js" || fail "Missing server entry file: ${INSTALL_DIR}/server/index.js"
  run_silent run_as_root test -d "$INSTALL_DIR/server/node_modules/express" || fail "Server dependencies are missing. Run npm --prefix ${INSTALL_DIR}/server install."
  run_silent run_as_root test -d "$INSTALL_DIR/server/node_modules/socket.io" || fail "Socket.IO dependency is missing. Run npm --prefix ${INSTALL_DIR}/server install."
  run_silent run_as_root test -f "$INSTALL_DIR/client/dist/index.html" || fail "Client build is missing. Run npm --prefix ${INSTALL_DIR}/client run build."
  run_silent run_as_root chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR/data" "$INSTALL_DIR/logs" || fail "Failed to set BirdX runtime ownership."
}

wait_for_birdx_service() {
  sync_values_from_env
  local attempt
  local health_url="http://127.0.0.1:${SERVER_PORT}/api/health"

  log "Checking BirdX backend at ${health_url}..."
  for attempt in {1..30}; do
    if run_as_root_output curl -fsS --max-time 2 "$health_url" >/dev/null 2>&1; then
      log "BirdX backend is responding on port ${SERVER_PORT}."
      return 0
    fi
    sleep 1
  done

  warn "BirdX backend did not respond on port ${SERVER_PORT}."
  run_as_root systemctl status birdx.service --no-pager -l || true
  run_as_root journalctl -u birdx.service --no-pager -n 80 || true
  fail "BirdX backend is not ready; nginx would return 502 Bad Gateway."
}

configure_systemd_service() {
  log "Creating systemd service at ${SERVICE_FILE}..."
  [[ -n "$NODE_EXEC_PATH" ]] || resolve_node_exec_path
  run_silent run_as_root tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=BirdX server
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${INSTALL_DIR}/server
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${NODE_EXEC_PATH} ${INSTALL_DIR}/server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  run_as_root systemctl daemon-reload
  run_as_root systemctl enable --now birdx.service
  run_as_root systemctl restart birdx.service
  wait_for_birdx_service
}

write_nginx_site_config() {
  local mode="${1:-http}"
  local cert_path="${2:-}"
  local key_path="${3:-}"
  local server_name_line="server_name ${NGINX_SERVER_NAME};"
  local listen_line="listen ${CLIENT_PORT} default_server;"
  local ssl_block=""
  local acme_block=""
  local redirect_acme_block=""
  local redirect_server_block=""
  local redirect_port_suffix=""

  if [[ "$mode" == "http" && "$CERT_MODE" != "http" ]]; then
    listen_line="listen 80 default_server;"
  fi

  if [[ "$CERT_MODE" == "certbot" ]]; then
    run_silent run_as_root mkdir -p "$ACME_WEBROOT/.well-known/acme-challenge" || return 1
    redirect_acme_block=$(cat <<EOF

  location /.well-known/acme-challenge/ {
    root ${ACME_WEBROOT};
    default_type "text/plain";
  }
EOF
)
  fi

  if [[ "$mode" == "ssl" ]]; then
    listen_line="listen ${CLIENT_PORT} ssl default_server;"
    if [[ "$CLIENT_PORT" != "443" ]]; then
      redirect_port_suffix=":${CLIENT_PORT}"
    fi
    ssl_block=$(cat <<EOF
  ssl_certificate ${cert_path};
  ssl_certificate_key ${key_path};
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
EOF
)

    if [[ "$CLIENT_PORT" != "80" ]]; then
      redirect_server_block=$(cat <<EOF

server {
  listen 80;
  ${server_name_line}
${redirect_acme_block}
  location / {
    return 301 https://\$host${redirect_port_suffix}\$request_uri;
  }
}
EOF
)
    fi
  fi

  if [[ "$mode" == "http" && "$CERT_MODE" == "certbot" ]]; then
    acme_block=$(cat <<EOF

  location /.well-known/acme-challenge/ {
    root ${ACME_WEBROOT};
    default_type "text/plain";
  }
EOF
)
  fi

  log "Creating Nginx config at ${NGINX_SITE_FILE}..."
  run_silent run_as_root tee "$NGINX_SITE_FILE" >/dev/null <<EOF
server {
  ${listen_line}
  ${server_name_line}
  client_max_body_size ${MAX_UPLOAD};
${ssl_block}
${acme_block}

  location /api/events {
    proxy_pass http://127.0.0.1:${SERVER_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    proxy_buffering off;
    proxy_cache off;
    add_header X-Accel-Buffering no;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:${SERVER_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    proxy_buffering off;
    proxy_cache_bypass \$http_upgrade;
  }

  location / {
    proxy_pass http://127.0.0.1:${SERVER_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
  }
}
${redirect_server_block}
EOF
}

configure_nginx() {
  log "Preparing initial HTTP nginx configuration..."
  write_nginx_site_config "http" || return 1

  run_as_root ln -sfn "$NGINX_SITE_FILE" "$NGINX_ENABLED_FILE" || return 1
  if run_as_root test -f /etc/nginx/sites-enabled/default; then
    run_as_root rm -f /etc/nginx/sites-enabled/default || return 1
  fi

  log "Testing nginx configuration..."
  run_as_root nginx -t || return 1
  log "Reloading nginx..."
  run_as_root systemctl reload nginx || return 1
  log "Initial nginx configuration is active."
}

install_ssl_files_into_nginx() {
  local cert_path="$1"
  local key_path="$2"
  local backup_file=""

  if [[ -f "$NGINX_SITE_FILE" ]]; then
    backup_file="${NGINX_SITE_FILE}.bak.$(date +%Y%m%d%H%M%S)"
    run_silent run_as_root cp "$NGINX_SITE_FILE" "$backup_file" || return 1
  fi

  if ! write_nginx_site_config "ssl" "$cert_path" "$key_path"; then
    warn "Failed to write nginx SSL config. Restoring previous nginx config."
    if [[ -n "$backup_file" ]]; then
      run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
    fi
    return 1
  fi
  if ! run_as_root nginx -t; then
    warn "Nginx SSL config test failed. Restoring previous nginx config."
    if [[ -n "$backup_file" ]]; then
      run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
      run_as_root nginx -t || true
    fi
    return 1
  fi

  if ! run_as_root systemctl reload nginx; then
    warn "Nginx reload failed. Restoring previous nginx config."
    if [[ -n "$backup_file" ]]; then
      run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
      run_as_root nginx -t || true
      run_as_root systemctl reload nginx || true
    fi
    return 1
  fi

  log "Nginx SSL configured."
}

configure_manual_ssl_files() {
  if [[ ! -f "$MANUAL_CERT_FULLCHAIN_PATH" || ! -f "$MANUAL_CERT_PRIVKEY_PATH" ]]; then
    fail "Manual certificate files were not found."
  fi

  local fullchain_target="$CERT_INSTALL_DIR/fullchain.pem"
  local privkey_target="$CERT_INSTALL_DIR/privkey.pem"
  local tmp_fullchain="$CERT_INSTALL_DIR/fullchain.pem.tmp.$$"
  local tmp_privkey="$CERT_INSTALL_DIR/privkey.pem.tmp.$$"
  local backup_fullchain=""
  local backup_privkey=""

  run_silent run_as_root mkdir -p "$CERT_INSTALL_DIR" || return 1

  if [[ -f "$fullchain_target" ]]; then
    backup_fullchain="$CERT_INSTALL_DIR/fullchain.pem.bak.$(date +%Y%m%d%H%M%S)"
    run_silent run_as_root cp -p "$fullchain_target" "$backup_fullchain" || return 1
  fi
  if [[ -f "$privkey_target" ]]; then
    backup_privkey="$CERT_INSTALL_DIR/privkey.pem.bak.$(date +%Y%m%d%H%M%S)"
    run_silent run_as_root cp -p "$privkey_target" "$backup_privkey" || return 1
  fi

  run_silent run_as_root cp -Lf "$MANUAL_CERT_FULLCHAIN_PATH" "$tmp_fullchain" || return 1
  run_silent run_as_root cp -Lf "$MANUAL_CERT_PRIVKEY_PATH" "$tmp_privkey" || {
    run_silent run_as_root rm -f "$tmp_fullchain"
    return 1
  }
  run_silent run_as_root chmod 644 "$tmp_fullchain" || return 1
  run_silent run_as_root chmod 600 "$tmp_privkey" || return 1
  run_silent run_as_root mv -f "$tmp_fullchain" "$fullchain_target" || return 1
  if ! run_silent run_as_root mv -f "$tmp_privkey" "$privkey_target"; then
    if [[ -n "$backup_fullchain" ]]; then
      run_silent run_as_root cp -p "$backup_fullchain" "$fullchain_target"
    else
      run_silent run_as_root rm -f "$fullchain_target"
    fi
    return 1
  fi

  if install_ssl_files_into_nginx "$fullchain_target" "$privkey_target"; then
    log "Manual TLS certificate files installed into ${CERT_INSTALL_DIR}."
    return 0
  fi

  warn "Manual TLS setup failed. Restoring previous certificate files when available."
  if [[ -n "$backup_fullchain" ]]; then
    run_silent run_as_root cp -p "$backup_fullchain" "$fullchain_target"
  else
    run_silent run_as_root rm -f "$fullchain_target"
  fi
  if [[ -n "$backup_privkey" ]]; then
    run_silent run_as_root cp -p "$backup_privkey" "$privkey_target"
  else
    run_silent run_as_root rm -f "$privkey_target"
  fi
  return 1
}

install_lego_certificate_files() {
  local cert_name="$1"
  local cert_file="${LEGO_STATE_DIR}/certificates/${cert_name}.crt"
  local issuer_file="${LEGO_STATE_DIR}/certificates/${cert_name}.issuer.crt"
  local key_file="${LEGO_STATE_DIR}/certificates/${cert_name}.key"

  [[ -f "$cert_file" ]] || fail "lego certificate file not found: ${cert_file}"
  [[ -f "$key_file" ]] || fail "lego private key file not found: ${key_file}"

  run_silent run_as_root mkdir -p "$CERT_INSTALL_DIR"
  run_silent run_as_root env CERT_FILE="$cert_file" ISSUER_FILE="$issuer_file" FULLCHAIN_FILE="$CERT_INSTALL_DIR/fullchain.pem" bash -lc '
    cat "$CERT_FILE" > "$FULLCHAIN_FILE"
    if [[ -f "$ISSUER_FILE" ]]; then
      cat "$ISSUER_FILE" >> "$FULLCHAIN_FILE"
    fi
  ' || {
    fail "Unable to assemble fullchain.pem from lego certificate files."
  }
  run_silent run_as_root cp -Lf "$key_file" "$CERT_INSTALL_DIR/privkey.pem"
  run_silent run_as_root chmod 644 "$CERT_INSTALL_DIR/fullchain.pem"
  run_silent run_as_root chmod 600 "$CERT_INSTALL_DIR/privkey.pem"

  install_ssl_files_into_nginx "$CERT_INSTALL_DIR/fullchain.pem" "$CERT_INSTALL_DIR/privkey.pem"
}

configure_lego_ip_ssl() {
  [[ -n "$CERTBOT_IP_ADDRESS" ]] || fail "Missing public IP address for Certbot IP certificate setup."

  ensure_lego_installed
  run_silent run_as_root mkdir -p "$ACME_WEBROOT/.well-known/acme-challenge"
  run_silent run_as_root mkdir -p "$LEGO_STATE_DIR"

  log "Requesting 6-day IP certificate for ${CERTBOT_IP_ADDRESS} with lego..."
  run_logged_quiet run_as_root "$LEGO_BIN" \
    --accept-tos \
    --email "$CERTBOT_EMAIL" \
    --path "$LEGO_STATE_DIR" \
    --disable-cn \
    --http \
    --http.webroot "$ACME_WEBROOT" \
    --domains "$CERTBOT_IP_ADDRESS" \
    run \
    --profile shortlived || {
      warn "ERROR: lego failed for IP ${CERTBOT_IP_ADDRESS}"
      return 1
    }

  install_lego_certificate_files "$CERTBOT_IP_ADDRESS"
  configure_lego_renewal_timer
  log "Nginx SSL configured for IP ${CERTBOT_IP_ADDRESS}."
}

configure_lego_renewal_timer() {
  [[ -x "$LEGO_BIN" ]] || fail "lego binary not found at ${LEGO_BIN}."
  log "Creating lego renewal service at ${LEGO_RENEW_SERVICE_FILE}..."
  run_silent run_as_root tee "$LEGO_RENEW_SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Renew BirdX IP certificate with lego
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=oneshot
User=root
Group=root
ExecStart=${LEGO_BIN} --accept-tos --email ${CERTBOT_EMAIL} --path ${LEGO_STATE_DIR} --disable-cn --http --http.webroot ${ACME_WEBROOT} --domains ${CERTBOT_IP_ADDRESS} renew --dynamic --profile shortlived
ExecStartPost=/bin/bash -lc 'cat "${LEGO_STATE_DIR}/certificates/${CERTBOT_IP_ADDRESS}.crt" > "${CERT_INSTALL_DIR}/fullchain.pem" && if [[ -f "${LEGO_STATE_DIR}/certificates/${CERTBOT_IP_ADDRESS}.issuer.crt" ]]; then cat "${LEGO_STATE_DIR}/certificates/${CERTBOT_IP_ADDRESS}.issuer.crt" >> "${CERT_INSTALL_DIR}/fullchain.pem"; fi && cp -Lf "${LEGO_STATE_DIR}/certificates/${CERTBOT_IP_ADDRESS}.key" "${CERT_INSTALL_DIR}/privkey.pem" && chmod 644 "${CERT_INSTALL_DIR}/fullchain.pem" && chmod 600 "${CERT_INSTALL_DIR}/privkey.pem" && systemctl reload nginx'

[Install]
WantedBy=multi-user.target
EOF

  log "Creating lego renewal timer at ${LEGO_RENEW_TIMER_FILE}..."
  run_silent run_as_root tee "$LEGO_RENEW_TIMER_FILE" >/dev/null <<EOF
[Unit]
Description=Run BirdX lego renewal twice daily

[Timer]
OnBootSec=10m
OnUnitActiveSec=12h
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF

  run_as_root systemctl daemon-reload
  run_as_root systemctl enable --now birdx-lego-renew.timer
}

configure_ssl_if_needed() {
  case "$CERT_MODE" in
    http)
      log "HTTP-only mode selected. Skipping TLS setup."
      return 0
      ;;
    files)
      log "Installing TLS certificate files into nginx..."
      configure_manual_ssl_files
      return $?
      ;;
  esac

  if [[ "$DEPLOY_MODE" == "ip" ]]; then
    configure_lego_ip_ssl
    return $?
  fi

  run_silent run_as_root mkdir -p "$ACME_WEBROOT/.well-known/acme-challenge" || return 1

  local certbot_d_args=()
  local d
  for d in "${DOMAIN_NAMES[@]}"; do
    certbot_d_args+=(-d "$d")
  done

  log "Requesting or reusing SSL certificate for: ${DOMAIN_NAMES[*]}"
  run_as_root certbot certonly \
    --webroot \
    --webroot-path "$ACME_WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$CERTBOT_EMAIL" \
    --cert-name "${DOMAIN_NAMES[0]}" \
    --expand \
    "${certbot_d_args[@]}" || { warn "ERROR: Certbot failed for: ${DOMAIN_NAMES[*]}"; return 1; }

  log "Configuring nginx SSL for: ${DOMAIN_NAMES[*]}"
  local cert_path="/etc/letsencrypt/live/${DOMAIN_NAMES[0]}/fullchain.pem"
  local key_path="/etc/letsencrypt/live/${DOMAIN_NAMES[0]}/privkey.pem"
  if ! run_as_root test -f "$cert_path" || ! run_as_root test -f "$key_path"; then
    warn "Expected certificate files were not found under /etc/letsencrypt/live/${DOMAIN_NAMES[0]}."
    return 1
  fi

  install_ssl_files_into_nginx "$cert_path" "$key_path" || return 1

  log "Nginx SSL configured for: ${DOMAIN_NAMES[*]}"
}

restore_backup_if_provided() {
  if [[ -z "$DB_BACKUP_PATH" ]]; then
    return 0
  fi
  if [[ ! -f "$DB_BACKUP_PATH" ]]; then
    warn "Backup file not found: $DB_BACKUP_PATH"
    return 1
  fi
  if ! have_cmd unzip; then
    fail "unzip is required to restore backups. Install it first and retry."
  fi
  if [[ ! -d "$INSTALL_DIR/server" ]]; then
    fail "Server directory not found at ${INSTALL_DIR}/server. Cannot restore backup."
  fi

  log "Restoring data from backup: $DB_BACKUP_PATH"
  local cmd=(npm --prefix server run db:restore -- -y --file "$DB_BACKUP_PATH")
  if [[ -n "${DB_BACKUP_PASSWORD:-}" ]]; then
    cmd+=(--password "$DB_BACKUP_PASSWORD")
  fi

  if [[ "${RESTORE_BACKUP_QUIET:-no}" == "yes" ]]; then
    if ! run_db_command_logged_quiet "${cmd[@]}"; then
      return 1
    fi
    return 0
  fi

  if ! run_db_command "${cmd[@]}"; then
    return 1
  fi
}

backup_database() {
  if [[ ! -d "$INSTALL_DIR/server" ]]; then
    warn "Server directory not found; skipping DB backup."
    return 0
  fi
  local backup_password=""
  backup_password="$(prompt_secret "Backup password")"
  log "Backing up database before update..."
  if ! run_in_install_dir "npm --prefix server run db:backup -- --password $(printf '%q' "$backup_password")"; then
    warn "DB backup command failed. Continuing, but verify backups manually."
  fi
}

preserve_backup_and_restore_data() {
  log "Preserving data directory during update..."
  # Since /data/ is in .gitignore, it will remain untouched during git operations
  # However, we locate the backup zip for recovery purposes if needed
  if [[ -d "$INSTALL_DIR/data/backups" ]]; then
    local latest_backup="$(ls -t "$INSTALL_DIR/data/backups"/*.zip 2>/dev/null | head -1)"
    if [[ -n "$latest_backup" ]]; then
      # Copy backup to root directory for easy access and recovery
      local backup_filename="$(basename "$latest_backup")"
      log "Found database backup: $latest_backup"
      
      if run_silent run_as_root cp "$latest_backup" "/$backup_filename"; then
        log "✓ Backup copied to /$backup_filename for recovery purposes."
      else
        warn "Failed to copy backup to /. Backup remains in $INSTALL_DIR/data/backups/"
      fi
    fi
  fi
  log "Data directory (/data/) will remain untouched during git update."
}

run_migrations() {
  if [[ ! -d "$INSTALL_DIR/server" ]]; then
    warn "Server directory not found; skipping DB migrations."
    return 0
  fi
  log "Running database migrations..."
  run_in_install_dir "npm --prefix server run db:migrate"
}

update_nginx_runtime_values() {
  if [[ ! -f "$NGINX_SITE_FILE" ]]; then
    warn "Nginx site config not found at ${NGINX_SITE_FILE}. Skipping nginx update."
    return 1
  fi

  read_nginx_server_name_from_existing_config || true

  local backup_file="${NGINX_SITE_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  run_silent run_as_root cp "$NGINX_SITE_FILE" "$backup_file"

  run_silent run_as_root sed -i -E \
    "s|proxy_pass http://127\\.0\\.0\\.1:[0-9]+;|proxy_pass http://127.0.0.1:${SERVER_PORT};|g" \
    "$NGINX_SITE_FILE"

  local existing_cert=""
  local existing_key=""
  existing_cert="$(run_as_root_output grep -E '^\s*ssl_certificate ' "$NGINX_SITE_FILE" | head -n 1 | sed -E 's/^\s*ssl_certificate\s+([^;]+);/\1/' | tr -d '\r\n')" || existing_cert=""
  existing_key="$(run_as_root_output grep -E '^\s*ssl_certificate_key ' "$NGINX_SITE_FILE" | head -n 1 | sed -E 's/^\s*ssl_certificate_key\s+([^;]+);/\1/' | tr -d '\r\n')" || existing_key=""

  if [[ -n "$existing_cert" && -n "$existing_key" ]]; then
    if ! write_nginx_site_config "ssl" "$existing_cert" "$existing_key"; then
      warn "Failed to rewrite nginx config. Restoring previous config."
      run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
      return 1
    fi
  else
    if ! write_nginx_site_config "http"; then
      warn "Failed to rewrite nginx config. Restoring previous config."
      run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
      return 1
    fi
  fi

  if run_as_root nginx -t; then
    run_as_root systemctl reload nginx
    log "Nginx updated with SERVER_PORT=${SERVER_PORT}, CLIENT_PORT=${CLIENT_PORT}, MAX_UPLOAD=${MAX_UPLOAD}."
    log "Backup saved at ${backup_file}."
    return 0
  fi

  warn "Nginx config test failed. Restoring previous config."
  run_silent run_as_root cp "$backup_file" "$NGINX_SITE_FILE"
  run_as_root nginx -t || true
  return 1
}

rebuild_and_restart_after_settings_change() {
  local needs_nginx="${1:-no}"
  sync_values_from_env
  log "Rebuilding client after settings change..."
  run_in_install_dir "npm --prefix client run build" || fail "Failed to rebuild client assets."
  ensure_runtime_layout

  log "Restarting BirdX service..."
  run_as_root systemctl restart birdx.service
  wait_for_birdx_service

  if [[ "$needs_nginx" == "yes" ]]; then
    log "Updating Nginx config for SERVER_PORT/CLIENT_PORT/MAX_UPLOAD changes..."
    update_nginx_runtime_values || warn "Nginx update failed. Review ${NGINX_SITE_FILE}."
  else
    log "Nginx update not required (SERVER_PORT/CLIENT_PORT/MAX_UPLOAD unchanged)."
  fi
}

update_birdx() {
  if [[ -d "$INSTALL_DIR" ]]; then
    if [[ "$(prompt_yes_no "Create a database backup before updating?" "no")" == "yes" ]]; then
      backup_database
    else
      log "Skipping pre-update backup."
    fi
  else
    warn "No BirdX install found at ${INSTALL_DIR}."
    press_enter_to_continue
    return 0
  fi

  prompt_source_mode

  if [[ "$SOURCE_MODE" == "offline" ]]; then
    ensure_offline_source_ready "update" || return 0

    local offline_zip_path="$SOURCE_ZIP_PATH"
    local extract_result=""
    extract_result="$(extract_offline_source_zip "$offline_zip_path" "update")"
    local tmp_dir="${extract_result%%|*}"
    local source_root="${extract_result#*|}"

    if ! offline_source_is_newer "$source_root" "$INSTALL_DIR"; then
      run_silent run_as_root rm -rf "$tmp_dir"
      log "BirdX is already up to date. No rebuild needed."
      press_enter_to_continue
      return 0
    fi

    run_silent run_as_root rm -rf "$tmp_dir"

    log "Offline update available. Preparing to update BirdX..."
    preserve_backup_and_restore_data
    update_source_from_zip "$offline_zip_path"

    log "Installing dependencies..."
    install_birdx_dependencies
    ensure_runtime_layout
    ensure_vapid_keys

    log "Synchronizing database schema with latest version..."
    run_migrations

    apply_ownership

    log "Restarting BirdX service..."
    run_as_root systemctl restart birdx.service
    wait_for_birdx_service
    run_as_root systemctl reload nginx

    log "Update completed successfully."
    press_enter_to_continue
    return 0
  fi

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    :
  else
    warn "No git checkout found at ${INSTALL_DIR}. Update requires GitHub mode."
    press_enter_to_continue
    return 0
  fi

  # Fetch latest from remote
  log "Checking for updates..."
  if ! run_in_install_dir "git fetch --all --prune"; then
    warn "Failed to fetch from remote. Check your network and credentials."
    press_enter_to_continue
    return 1
  fi

  # Get local and remote commit hashes
  local local_commit remote_commit
  local_commit="$(run_in_install_dir_output "git rev-parse HEAD" | tr -d '\r\n')"
  remote_commit="$(run_in_install_dir_output "git rev-parse origin/master" | tr -d '\r\n')"

  if [[ -z "$local_commit" || -z "$remote_commit" ]]; then
    warn "Failed to determine current version. Check git repository status."
    press_enter_to_continue
    return 1
  fi

  # Check if update is available
  if [[ "$local_commit" == "$remote_commit" ]]; then
    log "BirdX is already up to date. No rebuild needed."
    press_enter_to_continue
    return 0
  fi

  # Update is available - proceed with safe update
  log "Update available. Preparing to update BirdX..."
  preserve_backup_and_restore_data

  # Ensure we're on main branch and pull latest
  if ! run_in_install_dir "git checkout master"; then
    warn "Failed to checkout main branch."
    press_enter_to_continue
    return 1
  fi

  if ! run_in_install_dir "git pull --ff-only origin master"; then
    warn "Failed to pull updates. Repository may have non-fast-forward changes."
    press_enter_to_continue
    return 1
  fi

  log "Installing dependencies..."
  install_birdx_dependencies
  ensure_runtime_layout
  ensure_vapid_keys
  
  log "Synchronizing database schema with latest version..."
  run_migrations

  apply_ownership

  log "Restarting BirdX service..."
  run_as_root systemctl restart birdx.service
  wait_for_birdx_service
  run_as_root systemctl reload nginx

  log "Update completed successfully."
  press_enter_to_continue
}

restart_birdx() {
  log "Restarting BirdX service..."
  sync_values_from_env
  run_as_root systemctl restart birdx.service
  wait_for_birdx_service
  run_as_root systemctl reload nginx

  log "BirdX restarted successfully."
  press_enter_to_continue
}

edit_settings() {
  local env_file="${INSTALL_DIR}/.env"
  if [[ ! -f "$env_file" ]]; then
    warn "No .env found at ${env_file}. Run install first."
    press_enter_to_continue
    return 0
  fi

  local legacy_port existing_server existing_client
  legacy_port="$(get_existing_env_value "PORT" "")"
  existing_server="$(get_existing_env_value "SERVER_PORT" "")"
  existing_client="$(get_existing_env_value "CLIENT_PORT" "")"
  if [[ -n "$legacy_port" && -z "$existing_server" ]]; then
    replace_env_value "$env_file" "SERVER_PORT" "$legacy_port"
  fi
  if [[ -z "$existing_client" ]]; then
    replace_env_value "$env_file" "CLIENT_PORT" "$DEFAULT_CLIENT_PORT"
  fi

  local before_server before_client before_max
  before_server="$(get_existing_env_value_with_fallback "SERVER_PORT" "PORT" "$DEFAULT_SERVER_PORT")"
  before_client="$(get_existing_env_value "CLIENT_PORT" "$DEFAULT_CLIENT_PORT")"
  before_max="$(get_existing_env_value "FILE_UPLOAD_MAX_TOTAL_SIZE" "$DEFAULT_MAX_UPLOAD")"

  local before after
  before="$(sha256sum "$env_file" | awk '{print $1}')"

  open_env_editor "$env_file"

  after="$(sha256sum "$env_file" | awk '{print $1}')"

  if [[ "$before" == "$after" ]]; then
    log "No changes detected in .env. Skipping rebuild."
    return 0
  fi

  local after_server after_client after_max
  after_server="$(get_existing_env_value_with_fallback "SERVER_PORT" "PORT" "$DEFAULT_SERVER_PORT")"
  after_client="$(get_existing_env_value "CLIENT_PORT" "$DEFAULT_CLIENT_PORT")"
  after_max="$(get_existing_env_value "FILE_UPLOAD_MAX_TOTAL_SIZE" "$DEFAULT_MAX_UPLOAD")"

  local needs_nginx="no"
  if [[ "$before_server" != "$after_server" || "$before_client" != "$after_client" || "$before_max" != "$after_max" ]]; then
    needs_nginx="yes"
  fi

  log "Changes detected. Applying updates..."
  rebuild_and_restart_after_settings_change "$needs_nginx"
  log "Settings applied."
  press_enter_to_continue
}

remove_birdx() {
  if [[ ! -d "$INSTALL_DIR" ]]; then
    warn "No install found at ${INSTALL_DIR}."
    press_enter_to_continue
    return 0
  fi
  
  if [[ "$(prompt_yes_no "This will remove BirdX from this server. Continue?" "no")" != "yes" ]]; then
    log "Removal canceled."
    return 0
  fi

  if run_as_root systemctl list-unit-files | grep -q "^birdx.service"; then
    run_as_root systemctl disable --now birdx.service || true
  fi
  if run_as_root systemctl list-unit-files | grep -q "^birdx-lego-renew.timer"; then
    run_as_root systemctl disable --now birdx-lego-renew.timer || true
  fi
  run_as_root rm -f "$SERVICE_FILE"
  run_as_root rm -f "$LEGO_RENEW_SERVICE_FILE" "$LEGO_RENEW_TIMER_FILE"
  run_as_root systemctl daemon-reload

  run_as_root rm -f "$NGINX_ENABLED_FILE"
  run_as_root rm -f "$NGINX_SITE_FILE"
  if run_as_root nginx -t >/dev/null 2>&1; then
    run_as_root systemctl reload nginx
  fi

  if [[ -d "$INSTALL_DIR" ]]; then
    run_as_root rm -rf "$INSTALL_DIR"
  fi
  if id -u "$SERVICE_USER" >/dev/null 2>&1; then
    run_as_root userdel "$SERVICE_USER" || true
  fi

  log "BirdX removed."

  if [[ -f "/usr/local/bin/birdx-deploy" ]]; then
    if [[ "$(prompt_yes_no "Remove global command (birdx-deploy) as well?" "no")" == "yes" ]]; then
      run_as_root rm -f "/usr/local/bin/birdx-deploy"
      log "Global command removed."
    fi
  fi

  press_enter_to_continue
}

install_birdx() {
  prompt_source_mode
  collect_install_options
  prompt_install_backup_restore
  install_required_packages
  ensure_nodejs_from_nodesource
  ensure_service_user_exists
  if [[ "$SOURCE_MODE" == "offline" ]]; then
    ensure_offline_source_ready "install" || return 0
    install_source_from_zip "$SOURCE_ZIP_PATH" || return 1
  else
    clone_repo || {
      warn "Failed to clone repository. Installation canceled."
      press_enter_to_continue
      return 1
    }
  fi
  ensure_log_dir
  write_full_env_with_defaults
  RESTORE_BACKUP_QUIET="yes"
  if ! restore_backup_if_provided; then
    RESTORE_BACKUP_QUIET="no"
    warn "Backup restore failed. Installation aborted. Review ${LOG_FILE} for details."
    press_enter_to_continue
    return 1
  fi
  RESTORE_BACKUP_QUIET="no"
  apply_turn_env_settings "$INSTALL_DIR/.env"
  configure_turn_server
  install_birdx_dependencies
  ensure_runtime_layout
  ensure_vapid_keys
  apply_ownership
  configure_systemd_service
  log "Starting nginx setup..."
  if ! configure_nginx; then
    warn "Nginx setup failed. Review ${NGINX_SITE_FILE} and ${LOG_FILE}."
    press_enter_to_continue
    return 1
  fi
  log "Starting TLS setup..."
  if ! configure_ssl_if_needed; then
    warn "TLS setup failed. Review ${NGINX_SITE_FILE} and ${LOG_FILE}."
    press_enter_to_continue
    return 1
  fi

  log "Installation complete."
  log "BirdX has been installed successfully."
  if [[ "$CERT_MODE" == "http" ]]; then
    if [[ "$DEPLOY_MODE" == "domain" ]]; then
      for d in "${DOMAIN_NAMES[@]}"; do
        log "Visit: http://${d}:${CLIENT_PORT}"
      done
    else
      log "Visit: http://<your-server-ip>:${CLIENT_PORT}"
    fi
  elif [[ "$DEPLOY_MODE" == "domain" ]]; then
    for d in "${DOMAIN_NAMES[@]}"; do
      if [[ "$CLIENT_PORT" == "443" ]]; then
        log "Visit: https://${d}"
      else
        log "Visit: https://${d}:${CLIENT_PORT}"
      fi
    done
  else
    local visit_ip="${CERTBOT_IP_ADDRESS:-<your-server-ip>}"
    if [[ "$CERT_MODE" == "files" ]]; then
      visit_ip="<your-server-ip>"
    fi
    if [[ "$CLIENT_PORT" == "443" ]]; then
      log "Visit: https://${visit_ip}"
    else
      log "Visit: https://${visit_ip}:${CLIENT_PORT}"
    fi
  fi
  if [[ "$TURN_ENABLED" == "true" ]]; then
    log "TURN endpoint: ${TURN_HOST}:3478 (username: ${TURN_USERNAME})"
    log_turn_firewall_hint
  fi

  press_enter_to_continue
}

install_global_command() {
  local target="/usr/local/bin/birdx-deploy"
  local source_hint="${BASH_SOURCE[0]:-}"
  local source_path=""

  if [[ -n "$source_hint" ]]; then
    if [[ "$source_hint" != /* ]]; then
      source_hint="$(pwd)/$source_hint"
    fi
    if [[ -f "$source_hint" ]]; then
      source_path="$source_hint"
    fi
  fi

  if [[ -n "$source_path" ]]; then
    run_silent run_as_root install -m 755 "$source_path" "$target"
  else
    log "Script source path is not a regular file. Installing global command..."
    if [[ -n "$SUDO" ]]; then
      curl -fsSL "$SCRIPT_REMOTE_URL" | $SUDO tee "$target" >/dev/null
      $SUDO chmod 755 "$target"
    else
      curl -fsSL "$SCRIPT_REMOTE_URL" > "$target"
      chmod 755 "$target"
    fi
  fi

  log "Global command installed: birdx-deploy"
  log "Run it from anywhere with: birdx-deploy"
  press_enter_to_continue
}

ensure_global_command_on_first_run() {
  local target="/usr/local/bin/birdx-deploy"
  if run_as_root test -x "$target"; then
    return 0
  fi
  log "Global command not found. Installing it automatically..."
  if ! install_global_command; then
    warn "Automatic global command installation failed. You can retry from the menu."
  fi
}

show_logs() {
  if [[ -f "$LOG_FILE" ]]; then
    clear
    printf "\n  Last %s lines of script log:\n\n" "$LOG_LINES"
    tail -n "$LOG_LINES" "$LOG_FILE"
  else
    printf "\n  No script log found at: %s\n" "$LOG_FILE"
  fi
  press_enter_to_continue
}

show_service_logs() {
  if systemctl list-units --type=service --all | grep birdx; then
    clear
    printf "\n  Last %s lines of birdx service log:\n\n" "$LOG_LINES"
    run_as_root journalctl -u birdx --no-pager -n "$LOG_LINES"
  else
    printf "\n  BirdX service not found.\n"
  fi
  press_enter_to_continue
}

show_nginx_access_logs() {
  local log_file="/var/log/nginx/access.log"

  if [[ -f "$log_file" ]]; then
    clear
    printf "\n  Last %s lines of nginx access log:\n\n" "$LOG_LINES"
    run_as_root tail -n "$LOG_LINES" "$log_file"
  else
    printf "\n  Nginx access log not found: %s\n" "$log_file"
  fi
  press_enter_to_continue
}

show_nginx_error_logs() {
  local log_file="/var/log/nginx/error.log"

  if [[ -f "$log_file" ]]; then
    clear
    printf "\n  Last %s lines of nginx error log:\n\n" "$LOG_LINES"
    run_as_root tail -n "$LOG_LINES" "$log_file"
  else
    printf "\n  Nginx error log not found: %s\n" "$log_file"
  fi
  press_enter_to_continue
}


show_banner() {
  printf '\033[1;36m'   # bold cyan
  cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║      ███████╗ ██████╗ ███╗   ██╗ ██████╗ ██████╗ ██╗██████╗ ██████╗       ║
║      ██╔════╝██╔═══██╗████╗  ██║██╔════╝ ██╔══██╗██║██╔══██╗██╔══██╗      ║
║      ███████╗██║   ██║██╔██╗ ██║██║  ███╗██████╔╝██║██████╔╝██║  ██║      ║
║      ╚════██║██║   ██║██║╚██╗██║██║   ██║██╔══██╗██║██╔══██╗██║  ██║      ║
║      ███████║╚██████╔╝██║ ╚████║╚██████╔╝██████╔╝██║██║  ██║██████╔╝      ║
║      ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═╝╚═════╝       ║
║                                                                           ║
║                           D E P L O Y   T O O L                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF
  printf '\033[0m'      # reset
}


show_menu() {
  clear
  show_banner
  printf "\n"
  printf "BirdX Deploy Menu\n"
  printf $'1) 📥  Install BirdX\n'
  printf $'2) 🔄️  Update BirdX\n'
  printf $'3) ♻️  Restart BirdX\n'
  printf $'4) ⚙️  Edit Settings (.env)\n'
  printf $'5) 🗃️  Manage Database\n'
  printf $'6) 🗑️  Remove BirdX\n'
  printf $'7) 🔄️  Reinstall global command (birdx-deploy)\n'
  printf $'8) 🌐  Configure mirrors\n'
  printf $'9) 📋  View Logs\n'
  printf $'10) 🚪  Exit\n\n'
}

show_logs_menu() {
  while true; do
    clear
    show_banner
    printf "\n"
    printf "Logs Menu\n"
    printf $'1) 📋  View script logs\n'
    printf $'2) 📋  View service logs\n'
    printf $'3) 📋 View nginx access logs\n'
    printf $'4) 📋  View nginx error logs\n'
    printf $'5) ↩️  Go back\n\n'

    prompt_read "Choose an option [1-5]: " choice
    case "$choice" in
      1) show_logs ;;
      2) show_service_logs ;;
      3) show_nginx_access_logs ;;
      4) show_nginx_error_logs ;;
      5) return ;;
      *) printf "Invalid choice. Select a number from 1 to 5.\n" ;;
    esac
  done
}

run_db_command() {
  local args=("$@")
  local escaped=""
  local part=""
  for part in "${args[@]}"; do
    escaped+=" $(printf '%q' "$part")"
  done
  run_as_root bash -lc "cd '$INSTALL_DIR' && ${escaped:1}"
}

run_db_command_interactive() {
  local args=("$@")
  local escaped=""
  local part=""
  for part in "${args[@]}"; do
    escaped+=" $(printf '%q' "$part")"
  done
  run_as_root bash -lc "cd '$INSTALL_DIR' && ${escaped:1} </dev/tty >/dev/tty 2>&1"
}

run_db_command_logged_quiet() {
  local args=("$@")
  local escaped=""
  local part=""
  for part in "${args[@]}"; do
    escaped+=" $(printf '%q' "$part")"
  done
  run_logged_quiet run_as_root bash -lc "cd '$INSTALL_DIR' && ${escaped:1}"
}

ensure_remote_channel_dependencies() {
  local resolve_telegram="require.resolve('telegram', { paths: [process.cwd() + '/server'] })"

  if run_db_command node -e "$resolve_telegram" >/dev/null 2>&1; then
    return 0
  fi

  warn "Remote Channel dependency 'telegram' is not installed. Installing server dependencies..."
  if [[ -n "$MIRROR_NPM" ]]; then
    run_db_command npm --prefix server --registry "$MIRROR_NPM" install
  else
    run_db_command npm --prefix server install
  fi

  if ! run_db_command node -e "$resolve_telegram" >/dev/null 2>&1; then
    warn "Unable to load the 'telegram' package after npm install. Check npm output and network access."
    return 1
  fi
}

resolve_chat_visibility_for_script() {
  local chat_selector="$1"
  [[ -n "$chat_selector" ]] || return 1

  run_as_root env INSTALL_DIR="$INSTALL_DIR" CHAT_SELECTOR="$chat_selector" bash -lc '
    cd "$INSTALL_DIR" || exit 1
    node --input-type=module -e "
      import { pathToFileURL } from \"node:url\";
      const rootUrl = pathToFileURL(process.cwd() + \"/\");
      const { openDatabase } = await import(new URL(\"./server/scripts/_db-admin.js\", rootUrl));
      const { resolveChatRow } = await import(new URL(\"./server/lib/dbToolHelpers.js\", rootUrl));
      const dbApi = await openDatabase();
      try {
        const chat = resolveChatRow(dbApi, String(process.env.CHAT_SELECTOR || \"\").trim());
        if (!chat?.id) {
          process.exit(2);
        }
        process.stdout.write(String(chat.group_visibility || \"public\").trim().toLowerCase() || \"public\");
      } finally {
        dbApi.close();
      }
    "
  '
}

print_db_script_help() {
  cat <<'EOF'
BirdX Script Database Menu

Use these menu actions inside this installer script:
  1-4   Inspect database/chats/users/files
  5     Backup database and uploads
  6     Restore a backup zip
  7     Vacuum the database
  8-13  Reset/delete/ban file+chat+user data
  14    Create one user
  15    Generate users in bulk
  16    Create a group or channel
  17    Add members to a chat
  18    Edit a chat
  19    Edit a user
  20    Show this help
  22    Configure Remote Channel Telegram login

Notes:
  - "Ban/unban user" is a toggle and expires that user's sessions.
  - Remote Channel mirrors Telegram channel posts into BirdX channels.
  - Public chats always allow member invites. Invite settings only apply to private chats.
  - Backups are encrypted zip files containing .env and data/.
EOF
}

db_backup() {
  local backup_password=""
  backup_password="$(prompt_secret "Backup password")"
  log "Creating backup (db + uploads)..."
  run_db_command npm --prefix server run db:backup -- --password "$backup_password"
  press_enter_to_continue
}

db_help() {
  clear
  show_banner
  printf "\n"
  print_db_script_help
  press_enter_to_continue
}

db_vacuum() {
  if [[ "$(prompt_yes_no "This will run VACUUM and rewrite the database file. Continue?" "no")" != "yes" ]]; then
    log "VACUUM canceled."
    return 0
  fi
  run_db_command npm --prefix server run db:vacuum -- -y
  press_enter_to_continue
}

db_restore() {
  local backup_path=""
  local backup_password=""

  backup_path="$(select_backup_zip_path)"
  if [[ "$(prompt_yes_no "This will replace ${INSTALL_DIR}/data and update ${INSTALL_DIR}/.env when the backup includes it. Continue?" "yes")" != "yes" ]]; then
    log "Restore canceled."
    return 0
  fi
  backup_password="$(prompt_secret_optional "Backup password (leave blank if not encrypted)")"
  if [[ -n "$backup_password" ]]; then
    run_db_command npm --prefix server run db:restore -- -y --file "$backup_path" --password "$backup_password"
  else
    run_db_command npm --prefix server run db:restore -- -y --file "$backup_path"
  fi
  press_enter_to_continue
}

db_inspect() {
  local kind="$1"
  local limit=""
  prompt_read "Enter row limit (default: 25): " limit
  limit="${limit#"${limit%%[![:space:]]*}"}"
  limit="${limit%"${limit##*[![:space:]]}"}"
  [[ -z "$limit" ]] && limit="25"

  case "$kind" in
    all) run_db_command npm --prefix server run db:inspect -- --limit "$limit" ;;
    chat) run_db_command npm --prefix server run db:chat:inspect -- --limit "$limit" ;;
    user) run_db_command npm --prefix server run db:user:inspect -- --limit "$limit" ;;
    file) run_db_command npm --prefix server run db:file:inspect -- --limit "$limit" ;;
  esac
  press_enter_to_continue
}

db_reset() {
  if [[ "$(prompt_yes_no "This will reset database and delete uploads. Continue?" "no")" != "yes" ]]; then
    log "Reset canceled."
    return 0
  fi
  local recreate="yes"
  if [[ "$(prompt_yes_no "Recreate a fresh database after reset?" "yes")" != "yes" ]]; then
    recreate="no"
  fi

  if [[ "$recreate" == "yes" ]]; then
    run_db_command npm --prefix server run db:reset -- -y --recreate
  else
    run_db_command npm --prefix server run db:reset -- -y --no-recreate
  fi
  press_enter_to_continue
}

db_delete() {
  if [[ "$(prompt_yes_no "This will permanently delete database and uploads. Continue?" "no")" != "yes" ]]; then
    log "Delete canceled."
    return 0
  fi
  run_db_command npm --prefix server run db:delete -- -y
  press_enter_to_continue
}

db_chat_delete() {
  local input=""
  prompt_read "Enter chat IDs (comma/space separated) or type 'all': " input
  input="$(printf "%s" "$input" | tr ',' ' ')"
  input="${input#"${input%%[![:space:]]*}"}"
  input="${input%"${input##*[![:space:]]}"}"

  if [[ -z "$input" ]]; then
    printf "No input provided.\n"
    return 0
  fi

  if [[ "${input,,}" == "all" ]]; then
    run_db_command npm --prefix server run db:chat:delete -- --all -y
  else
    run_db_command npm --prefix server run db:chat:delete -- -y $input
  fi
  press_enter_to_continue
}

db_file_delete() {
  local input=""
  prompt_read "Enter file IDs or stored names (comma/space separated) or type 'all': " input
  input="$(printf "%s" "$input" | tr ',' ' ')"
  input="${input#"${input%%[![:space:]]*}"}"
  input="${input%"${input##*[![:space:]]}"}"

  if [[ -z "$input" ]]; then
    printf "No input provided.\n"
    return 0
  fi

  if [[ "${input,,}" == "all" ]]; then
    run_db_command npm --prefix server run db:file:delete -- -y
  else
    run_db_command npm --prefix server run db:file:delete -- -y $input
  fi
  press_enter_to_continue
}

db_user_delete() {
  local input=""
  prompt_read "Enter user IDs or usernames (comma/space separated) or type 'all': " input
  input="$(printf "%s" "$input" | tr ',' ' ')"
  input="${input#"${input%%[![:space:]]*}"}"
  input="${input%"${input##*[![:space:]]}"}"

  if [[ -z "$input" ]]; then
    printf "No input provided.\n"
    return 0
  fi

  if [[ "${input,,}" == "all" ]]; then
    run_db_command npm --prefix server run db:user:delete -- --all -y
  else
    run_db_command npm --prefix server run db:user:delete -- -y $input
  fi
  press_enter_to_continue
}

db_user_create() {
  local nickname=""
  local username=""
  local password=""

  nickname="$(prompt_non_empty "Nickname")"
  username="$(prompt_non_empty "Username (lowercase letters, numbers, ., _)")"
  password="$(prompt_secret "Password")"

  run_db_command npm --prefix server run db:user:create -- \
    --nickname "$nickname" \
    --username "$username" \
    --password "$password"
  press_enter_to_continue
}

db_user_generate() {
  local count=""
  local password=""
  local nickname_prefix=""
  local username_prefix=""

  prompt_read "How many users to create? (default: 10): " count
  count="${count#"${count%%[![:space:]]*}"}"
  count="${count%"${count##*[![:space:]]}"}"
  [[ -z "$count" ]] && count="10"

  password="$(prompt_secret "Password for generated users? (default: Passw0rd!)")"
  [[ -z "$password" ]] && password="Passw0rd!"

  prompt_read "Nickname prefix (default: User): " nickname_prefix
  nickname_prefix="${nickname_prefix#"${nickname_prefix%%[![:space:]]*}"}"
  nickname_prefix="${nickname_prefix%"${nickname_prefix##*[![:space:]]}"}"
  [[ -z "$nickname_prefix" ]] && nickname_prefix="User"

  prompt_read "Username prefix (default: user): " username_prefix
  username_prefix="${username_prefix#"${username_prefix%%[![:space:]]*}"}"
  username_prefix="${username_prefix%"${username_prefix##*[![:space:]]}"}"
  [[ -z "$username_prefix" ]] && username_prefix="user"

  run_db_command npm --prefix server run db:user:generate -- \
    --count "$count" \
    --password "$password" \
    --nickname-prefix "$nickname_prefix" \
    --username-prefix "$username_prefix"
  press_enter_to_continue
}

db_chat_create() {
  local type=""
  local name=""
  local username=""
  local visibility=""
  local owner=""
  local members=""

  prompt_read "Type (group/channel, default: group): " type
  type="${type#"${type%%[![:space:]]*}"}"
  type="${type%"${type##*[![:space:]]}"}"
  [[ -z "$type" ]] && type="group"

  name="$(prompt_non_empty "Chat name")"
  username="$(prompt_non_empty "Chat username/handle (without @)")"
  prompt_read "Visibility (public/private, default: public): " visibility
  visibility="${visibility#"${visibility%%[![:space:]]*}"}"
  visibility="${visibility%"${visibility##*[![:space:]]}"}"
  [[ -z "$visibility" ]] && visibility="public"
  owner="$(prompt_non_empty "Owner username or id")"
  prompt_read "Add members (comma separated usernames/ids, optional): " members

  run_db_command npm --prefix server run db:chat:create -- \
    --type "$type" \
    --name "$name" \
    --owner "$owner" \
    --username "$username" \
    --visibility "$visibility" \
    --users "$members"
  press_enter_to_continue
}

db_chat_add() {
  local chat=""
  local users=""
  local add_all="no"

  chat="$(prompt_non_empty "Chat id or username")"
  add_all="$(prompt_yes_no "Add all users in the database to this chat?" "no")"

  if [[ "$add_all" == "yes" ]]; then
    run_db_command npm --prefix server run db:chat:add -- "$chat" --all
    press_enter_to_continue
    return 0
  fi

  users="$(prompt_non_empty "Usernames or ids (comma separated)")"
  users="$(printf "%s" "$users" | tr ',' ' ')"
  run_db_command npm --prefix server run db:chat:add -- "$chat" $users
  press_enter_to_continue
}

db_chat_edit() {
  local chat=""
  local name=""
  local username=""
  local visibility=""
  local color=""
  local owner=""
  local invites=""
  local effective_visibility=""
  local args=()

  chat="$(prompt_non_empty "Chat id or username")"
  prompt_read "New chat name (optional): " name
  prompt_read "New chat username/handle (optional, without @): " username
  prompt_read "Visibility (public/private, optional): " visibility
  prompt_read "Color hex (optional, example: #10b981): " color
  prompt_read "New owner username or id (optional): " owner

  args+=("$chat")
  [[ -n "$name" ]] && args+=(--name "$name")
  [[ -n "$username" ]] && args+=(--username "$username")
  [[ -n "$visibility" ]] && args+=(--visibility "$visibility")
  [[ -n "$color" ]] && args+=(--color "$color")
  [[ -n "$owner" ]] && args+=(--owner "$owner")

  if [[ -n "$visibility" ]]; then
    effective_visibility="${visibility,,}"
  else
    effective_visibility="$(resolve_chat_visibility_for_script "$chat" 2>/dev/null || true)"
  fi

  if [[ "$effective_visibility" == "private" ]]; then
    prompt_read "Member invites setting for this private chat (allow/deny, default: allow): " invites
    invites="${invites#"${invites%%[![:space:]]*}"}"
    invites="${invites%"${invites##*[![:space:]]}"}"
    [[ -z "$invites" ]] && invites="allow"
  else
    log "Skipping member invites prompt because public chats always allow invites."
  fi

  if [[ "${invites,,}" == "allow" ]]; then
    args+=(--allow-member-invites)
  elif [[ "${invites,,}" == "deny" || "${invites,,}" == "disallow" ]]; then
    args+=(--disallow-member-invites)
  fi

  run_db_command npm --prefix server run db:chat:edit -- "${args[@]}"
  press_enter_to_continue
}

db_user_edit() {
  local user=""
  local username=""
  local nickname=""
  local avatar_url=""
  local status=""
  local color=""
  local args=()

  user="$(prompt_non_empty "User id or username")"
  prompt_read "New username (optional): " username
  prompt_read "New display name (optional): " nickname
  prompt_read "Avatar URL (optional): " avatar_url
  prompt_read "Status (online/invisible, optional): " status
  prompt_read "Color hex (optional, example: #10b981): " color

  args+=("$user")
  [[ -n "$username" ]] && args+=(--username "$username")
  [[ -n "$nickname" ]] && args+=(--nickname "$nickname")
  [[ -n "$avatar_url" ]] && args+=(--avatar-url "$avatar_url")
  [[ -n "$status" ]] && args+=(--status "$status")
  [[ -n "$color" ]] && args+=(--color "$color")

  run_db_command npm --prefix server run db:user:edit -- "${args[@]}"
  press_enter_to_continue
}

db_user_ban() {
  local user=""
  user="$(prompt_non_empty "User id or username")"
  if [[ "$(prompt_yes_no "Toggle ban state for ${user} ?" "no")" != "yes" ]]; then
    log "Ban/unban canceled."
    return 0
  fi
  run_db_command npm --prefix server run db:user:ban -- -y "$user"
  press_enter_to_continue
}

db_remote_configure() {
  local current_api_id=""
  local current_api_hash=""
  local current_proxy_url=""
  local api_id=""
  local api_hash=""
  local proxy_url=""
  local phone_number=""
  local two_step_password=""
  local force_sms="no"
  local args=()

  if [[ ! -d "${INSTALL_DIR}/server" ]]; then
    warn "BirdX server directory not found at ${INSTALL_DIR}/server."
    press_enter_to_continue
    return 1
  fi

  if ! ensure_remote_channel_dependencies; then
    press_enter_to_continue
    return 1
  fi

  current_api_id="$(strip_surrounding_quotes "$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_ID" "")")"
  current_api_hash="$(strip_surrounding_quotes "$(get_existing_env_value "REMOTE_CHANNEL_TELEGRAM_API_HASH" "")")"
  current_proxy_url="$(strip_surrounding_quotes "$(get_existing_env_value "REMOTE_CHANNEL_PROXY_URL" "")")"
  [[ "$current_api_id" == "0" ]] && current_api_id=""

  while true; do
    if [[ -n "$current_api_id" ]]; then
      prompt_read "Telegram API ID (default: ${current_api_id}): " api_id
      [[ -z "$api_id" ]] && api_id="$current_api_id"
    else
      prompt_read "Telegram API ID: " api_id
    fi
    api_id="${api_id#"${api_id%%[![:space:]]*}"}"
    api_id="${api_id%"${api_id##*[![:space:]]}"}"
    if [[ "$api_id" =~ ^[0-9]+$ && "$api_id" -gt 0 ]]; then
      break
    fi
    printf "Please enter a positive numeric Telegram API ID.\n"
  done

  if [[ -n "$current_api_hash" ]]; then
    api_hash="$(prompt_secret_optional "Telegram API hash (leave blank to keep existing)")"
    [[ -z "$api_hash" ]] && api_hash="$current_api_hash"
  else
    api_hash="$(prompt_secret "Telegram API hash")"
  fi

  if [[ -n "$current_proxy_url" ]]; then
    prompt_read "Telegram proxy URL (optional; default: ${current_proxy_url}; type none to clear): " proxy_url
    [[ -z "$proxy_url" ]] && proxy_url="$current_proxy_url"
  else
    prompt_read "Telegram proxy URL (optional): " proxy_url
  fi
  proxy_url="${proxy_url#"${proxy_url%%[![:space:]]*}"}"
  proxy_url="${proxy_url%"${proxy_url##*[![:space:]]}"}"
  if [[ "${proxy_url,,}" == "none" || "${proxy_url,,}" == "no" || "${proxy_url,,}" == "direct" ]]; then
    proxy_url=""
  fi

  phone_number="$(prompt_non_empty "Telegram phone number (with country code)")"
  two_step_password="$(prompt_secret_optional "Telegram two-step password (leave blank if disabled)")"
  force_sms="$(prompt_yes_no "Force SMS delivery for the login code?" "no")"

  printf "\nTelegram will send a login code now. Enter that code when the helper asks for it.\n"
  args=(
    node server/scripts/configure-remote-channel.js
    --env-file "${INSTALL_DIR}/.env"
    --api-id "$api_id"
    --api-hash "$api_hash"
    --phone-number "$phone_number"
  )
  if [[ -n "$proxy_url" ]]; then
    args+=(--proxy-url "$proxy_url")
  else
    args+=(--no-proxy)
  fi
  if [[ -n "$two_step_password" ]]; then
    args+=(--password "$two_step_password")
  fi
  if [[ "$force_sms" == "yes" ]]; then
    args+=(--force-sms)
  fi

  if ! run_db_command_interactive "${args[@]}"; then
    press_enter_to_continue
    return 1
  fi

  press_enter_to_continue
}

db_restore_backup() {
  local resolved=""
  resolved="$(select_backup_zip_path)"

  if [[ "$(prompt_yes_no "This will replace ${INSTALL_DIR}/data. Continue?" "no")" != "yes" ]]; then
    log "Restore canceled."
    return 0
  fi

  DB_BACKUP_PATH="$resolved"
  restore_backup_if_provided
  press_enter_to_continue
}

show_db_menu() {
  while true; do
    clear
    show_banner
    printf "\n"
    printf "Manage Database\n"
    printf "1) 👁️  Inspect database (summary)\n"
    printf "2) 👁️  Inspect chats metadata\n"
    printf "3) 👁️  Inspect users\n"
    printf "4) 👁️  Inspect files\n"
    printf "5) 📤  Backup database\n"
    printf "6) ♻️  Restore backup\n"
    printf "7) 🧹  Vacuum database\n"
    printf "8) 🔄️  Reset database\n"
    printf "9) 🗑️  Delete database\n"
    printf "10) 🗑️  Delete chats\n"
    printf "11) 🗑️  Delete users\n"
    printf "12) 🚫  Ban/unban user\n"
    printf "13) 🗑️  Delete files\n"
    printf "14) 👤  Create user\n"
    printf "15) 👥  Generate users (bulk)\n"
    printf "16) 💬  Create group/channel\n"
    printf "17) ➕  Add members to chat\n"
    printf "18) ✏️  Edit chat\n"
    printf "19) ✏️ Edit user\n"
    printf "20) ❔  Show help\n"
    printf "21) ↩️  Go back\n\n"

    printf "22) Remote Channel: configure Telegram login\n"
    prompt_read "Choose an option [1-22]: " choice
    case "$choice" in
      1) db_inspect "all" ;;
      2) db_inspect "chat" ;;
      3) db_inspect "user" ;;
      4) db_inspect "file" ;;
      5) db_backup ;;
      6) db_restore ;;
      7) db_vacuum ;;
      8) db_reset ;;
      9) db_delete ;;
      10) db_chat_delete ;;
      11) db_user_delete ;;
      12) db_user_ban ;;
      13) db_file_delete ;;
      14) db_user_create ;;
      15) db_user_generate ;;
      16) db_chat_create ;;
      17) db_chat_add ;;
      18) db_chat_edit ;;
      19) db_user_edit ;;
      20) db_help ;;
      21) return ;;
      22) db_remote_configure ;;
      *) printf "Invalid choice. Select a number from 1 to 22.\n" ;;
    esac
  done
}

main() {
  init_prompt_io
  detect_os
  ensure_sudo
  ensure_global_command_on_first_run

  trap 'handle_exit' EXIT
  trap 'handle_interrupt' INT TERM

  local choice=""
  while true; do
    show_menu
    prompt_read "Choose an option [1-10]: " choice
    case "$choice" in
      1) install_birdx ;;
      2) update_birdx ;;
      3) restart_birdx ;;
      4) edit_settings ;;
      5) show_db_menu ;;
      6) remove_birdx ;;
      7) install_global_command ;;
      8) configure_mirrors_menu ;;
      9) show_logs_menu ;;
      10) break ;;
      *) printf "Invalid choice. Select a number from 1 to 10.\n" ;;
    esac
  done
}

main "$@"
