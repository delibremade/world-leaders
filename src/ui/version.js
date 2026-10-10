// Build stamp. package.json is the one source of the version; the title screen and HUD read it from here.
import pkg from '../../package.json' with { type: 'json' };

export const VERSION = pkg.version;
export const BUILD_STAMP = `BUILD v${VERSION}`;
