# BirdX — mediasoup worker bootstrap (source from install scripts).
# Avoids PyPI timeouts by downloading GitHub prebuilt binaries with curl when possible.

# Optional: export PIP_INDEX_URL=https://your-pypi-mirror/simple before install.

mediasoup_worker_valid() {
  local bin="$1"
  local status=0
  env -i "$bin" >/dev/null 2>&1 || status=$?
  [[ "$status" == "41" ]]
}

mediasoup_linux_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'x64' ;;
    aarch64|arm64) printf 'arm64' ;;
    *) return 1 ;;
  esac
}

# Install invoke into mediasoup/worker/pip_invoke using pip mirrors (for local C++ build).
mediasoup_seed_pip_invoke() {
  local ms_pkg="$1"
  local pip_invoke="${ms_pkg}/worker/pip_invoke"
  local mirrors=()
  local url

  [[ -n "${PIP_INDEX_URL:-}" ]] && mirrors+=("$PIP_INDEX_URL")
  mirrors+=(
    "https://pypi.tuna.tsinghua.edu.cn/simple"
    "https://mirrors.aliyun.com/pypi/simple/"
    "https://pypi.org/simple"
  )

  mkdir -p "$pip_invoke"
  for url in "${mirrors[@]}"; do
    local host="${url#https://}"
    host="${host%%/*}"
    if python3 -m pip install --upgrade --no-user --target "$pip_invoke" \
      --index-url "$url" --trusted-host "$host" --default-timeout 120 invoke 2>/dev/null; then
      return 0
    fi
  done

  if python3 -c 'import invoke' 2>/dev/null; then
    python3 -m pip install --upgrade --no-user --target "$pip_invoke" invoke 2>/dev/null && return 0
  fi
  return 1
}

# Place mediasoup-worker binary under node_modules/mediasoup/worker/out/Release/
mediasoup_bootstrap_worker() {
  local ms_pkg="$1"
  local version="$2"
  local release_dir="${ms_pkg}/worker/out/Release"
  local worker_bin="${release_dir}/mediasoup-worker"
  local arch platform kernel_m try_k url tmp tarname

  [[ -d "$ms_pkg" ]] || return 1
  arch="$(mediasoup_linux_arch)" || return 1
  platform="linux"
  kernel_m="$(uname -r | cut -d. -f1)"

  if [[ -x "$worker_bin" ]] && mediasoup_worker_valid "$worker_bin"; then
    return 0
  fi
  rm -f "$worker_bin"
  mkdir -p "$release_dir"

  for try_k in "$kernel_m" 6 5 4; do
    tarname="mediasoup-worker-${version}-${platform}-${arch}-kernel${try_k}.tgz"
    url="https://github.com/versatica/mediasoup/releases/download/${version}/${tarname}"
    tmp="$(mktemp -d)"
    if curl -4fsSL --retry 3 --retry-delay 2 "$url" -o "${tmp}/worker.tgz" 2>/dev/null; then
      if tar -xzf "${tmp}/worker.tgz" -C "$release_dir" 2>/dev/null; then
        chmod 0755 "$worker_bin" 2>/dev/null || true
        rm -rf "$tmp"
        if mediasoup_worker_valid "$worker_bin"; then
          return 0
        fi
        rm -f "$worker_bin"
      fi
    fi
    rm -rf "$tmp"
  done
  return 1
}

# npm ci --ignore-scripts for server, bootstrap worker, rebuild mediasoup if needed.
birdx_install_server_npm() {
  local app_root="$1"
  shift
  local npm_extra=("$@")

  export PYTHON="${PYTHON:-python3}"
  export PIP_DEFAULT_TIMEOUT="${PIP_DEFAULT_TIMEOUT:-120}"

  npm ci --prefix "${app_root}/server" --ignore-scripts "${npm_extra[@]}" \
    || return 1

  local ms_pkg="${app_root}/server/node_modules/mediasoup"
  local ms_ver
  ms_ver="$(node -p "require('${ms_pkg}/package.json').version" 2>/dev/null)" || return 1

  if mediasoup_bootstrap_worker "$ms_pkg" "$ms_ver"; then
    return 0
  fi

  mediasoup_seed_pip_invoke "$ms_pkg" || return 1
  (cd "$ms_pkg" && npm run postinstall) \
    || npm rebuild mediasoup --prefix "${app_root}/server" "${npm_extra[@]}" \
    || return 1

  [[ -x "${ms_pkg}/worker/out/Release/mediasoup-worker" ]]
}
