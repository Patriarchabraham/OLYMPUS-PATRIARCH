import { isInBundledMode } from 'src/utils/bundledMode.js';
import { getCurrentInstallationType } from 'src/utils/doctorDiagnostic.js';
import { isEnvTruthy } from 'src/utils/envUtils.js';
import { useStartupNotification } from './useStartupNotification.js';
const NPM_DEPRECATION_MESSAGE = 'Olympuz Coder has switched from npm to the native installer. Run `Olympuz Coder install` or see https://github.com/Gitlawb/Olympuz Coder#quick-start for more options.';
export function useNpmDeprecationNotification() {
  useStartupNotification(_temp as () => Promise<import('../../context/notifications.js').Notification | null>);
}
async function _temp() {
  if (isInBundledMode() || isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)) {
    return null;
  }
  const installationType = await getCurrentInstallationType();
  if (installationType === "development") {
    return null;
  }
  return {
    timeoutMs: 15000,
    key: "npm-deprecation-warning",
    text: NPM_DEPRECATION_MESSAGE,
    color: "warning" as const,
    priority: "high" as const
  };
}
