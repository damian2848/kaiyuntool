#!/usr/bin/env bash
set -euo pipefail

# Local checkout: install its exact checked-out bundles. curl | bash: use a disposable clone.
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "${script_dir}/install.mjs" ]]; then
    exec node "${script_dir}/install.mjs" "$@"
  fi
fi

for command_name in git node; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    printf '安装失败：请先安装 %s（Node.js 需 20+）。\n' "${command_name}" >&2
    exit 1
  }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20+ is required."); process.exit(1); }'
install_tmp="$(mktemp -d "${TMPDIR:-/tmp}/kaiyuntool-skills.XXXXXXXX")"
trap 'rm -rf -- "${install_tmp}"' EXIT

# This release installer pins the bundles it installs, even when fetched via curl.
# KAIYUNTOOL_REF=main explicitly opts into the development/latest branch.
readonly github_repository="https://github.com/damian2848/kaiyuntool.git"
readonly default_repository="https://ghfast.top/https://github.com/damian2848/kaiyuntool.git"
repository_url="${KAIYUNTOOL_REPOSITORY_URL:-${default_repository}}"
repository_ref="${KAIYUNTOOL_REF:-v1.0.2}"

clone_repository() {
  git clone --depth 1 --branch "${repository_ref}" "$1" "${install_tmp}/repo"
}

printf '正在获取 KaiyunTool（%s）...\n' "${repository_ref}"
if ! clone_repository "${repository_url}"; then
  # An explicitly selected source is authoritative. Automatic fallback only
  # applies to the built-in mainland-friendly accelerator.
  if [[ -n "${KAIYUNTOOL_REPOSITORY_URL:-}" || "${repository_url}" == "${github_repository}" ]]; then
    exit 1
  fi
  printf '镜像源暂时不可用，正在回退 GitHub...\n' >&2
  rm -rf -- "${install_tmp}/repo"
  clone_repository "${github_repository}"
fi

node "${install_tmp}/repo/scripts/install.mjs" "$@"
