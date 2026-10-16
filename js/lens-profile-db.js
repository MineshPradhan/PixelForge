/**
 * PixelForge Studio — Automatic Lens Profile Database & Calibration Engine
 * Built-in camera and lens profile calibration tables (inspired by Lensfun standard).
 * Provides automatic and preset-driven profile matching for:
 *   - Distortion: Barrel (k1 < 0) / Pincushion (k1 > 0)
 *   - Lateral Chromatic Aberration (TCA): Red/Cyan and Blue/Yellow dispersion offsets
 *   - Optical Vignetting: Corner falloff compensation and midpoint
 *   - EXIF string matching for camera bodies and lenses
 */

class LensProfileDatabase {
  static PROFILES = [
    // ── Canon EF / RF ──
    {
      id: 'canon_ef_24_70_f28_ii',
      make: 'Canon',
      model: 'Canon EF 24-70mm f/2.8L II USM',
      focalLength: 24,
      distortion: -24,
      secondaryDistortion: 4,
      redCyanDefringe: 8,
      blueYellowDefringe: -6,
      vignetteAmount: 32,
      vignetteMidpoint: 45
    },
    {
      id: 'canon_ef_16_35_f28_iii',
      make: 'Canon',
      model: 'Canon EF 16-35mm f/2.8L III USM',
      focalLength: 16,
      distortion: -38,
      secondaryDistortion: 7,
      redCyanDefringe: 14,
      blueYellowDefringe: -10,
      vignetteAmount: 45,
      vignetteMidpoint: 40
    },
    {
      id: 'canon_rf_50_f12',
      make: 'Canon',
      model: 'Canon RF 50mm f/1.2L USM',
      focalLength: 50,
      distortion: 4,
      secondaryDistortion: -1,
      redCyanDefringe: 3,
      blueYellowDefringe: -2,
      vignetteAmount: 20,
      vignetteMidpoint: 60
    },

    // ── Sony FE ──
    {
      id: 'sony_fe_24_70_gm_ii',
      make: 'Sony',
      model: 'Sony FE 24-70mm f/2.8 GM II',
      focalLength: 24,
      distortion: -21,
      secondaryDistortion: 3,
      redCyanDefringe: 6,
      blueYellowDefringe: -5,
      vignetteAmount: 28,
      vignetteMidpoint: 50
    },
    {
      id: 'sony_fe_16_35_gm',
      make: 'Sony',
      model: 'Sony FE 16-35mm f/2.8 GM',
      focalLength: 16,
      distortion: -35,
      secondaryDistortion: 6,
      redCyanDefringe: 12,
      blueYellowDefringe: -8,
      vignetteAmount: 40,
      vignetteMidpoint: 42
    },
    {
      id: 'sony_fe_85_f14_gm',
      make: 'Sony',
      model: 'Sony FE 85mm f/1.4 GM',
      focalLength: 85,
      distortion: 6,
      secondaryDistortion: 0,
      redCyanDefringe: 4,
      blueYellowDefringe: -3,
      vignetteAmount: 18,
      vignetteMidpoint: 65
    },

    // ── Nikon NIKKOR Z / F ──
    {
      id: 'nikon_z_24_70_f28_s',
      make: 'Nikon',
      model: 'NIKKOR Z 24-70mm f/2.8 S',
      focalLength: 24,
      distortion: -20,
      secondaryDistortion: 3,
      redCyanDefringe: 7,
      blueYellowDefringe: -5,
      vignetteAmount: 26,
      vignetteMidpoint: 48
    },
    {
      id: 'nikon_z_14_24_f28_s',
      make: 'Nikon',
      model: 'NIKKOR Z 14-24mm f/2.8 S',
      focalLength: 14,
      distortion: -42,
      secondaryDistortion: 8,
      redCyanDefringe: 16,
      blueYellowDefringe: -12,
      vignetteAmount: 50,
      vignetteMidpoint: 38
    },
    {
      id: 'nikon_z_50_f18_s',
      make: 'Nikon',
      model: 'NIKKOR Z 50mm f/1.8 S',
      focalLength: 50,
      distortion: 2,
      secondaryDistortion: 0,
      redCyanDefringe: 2,
      blueYellowDefringe: -2,
      vignetteAmount: 14,
      vignetteMidpoint: 62
    },

    // ── Sigma & Tamron ──
    {
      id: 'sigma_24_70_art',
      make: 'Sigma',
      model: 'Sigma 24-70mm f/2.8 DG DN Art',
      focalLength: 24,
      distortion: -26,
      secondaryDistortion: 4,
      redCyanDefringe: 9,
      blueYellowDefringe: -7,
      vignetteAmount: 34,
      vignetteMidpoint: 45
    },
    {
      id: 'tamron_28_75_g2',
      make: 'Tamron',
      model: 'Tamron 28-75mm f/2.8 Di III VXD G2',
      focalLength: 28,
      distortion: -18,
      secondaryDistortion: 2,
      redCyanDefringe: 7,
      blueYellowDefringe: -5,
      vignetteAmount: 24,
      vignetteMidpoint: 52
    },

    // ── Ultra-Wide Action & Drone Lenses ──
    {
      id: 'action_fisheye_ultrawide',
      make: 'Generic',
      model: 'Action Cam / Drone Ultra-Wide Fisheye',
      focalLength: 12,
      distortion: -54,
      secondaryDistortion: 12,
      redCyanDefringe: 22,
      blueYellowDefringe: -16,
      vignetteAmount: 55,
      vignetteMidpoint: 35
    }
  ];

  /**
   * Matches camera make/model and lens EXIF strings against the database
   * @param {string} make
   * @param {string} model
   * @returns {Object|null} Best matching profile
   */
  static findProfile(make = '', model = '') {
    const qMake = (make || '').toLowerCase().trim();
    const qModel = (model || '').toLowerCase().trim();

    // Exact or substring match
    for (const p of this.PROFILES) {
      const pMake = p.make.toLowerCase();
      const pModel = p.model.toLowerCase();

      if (qModel.includes(pModel) || pModel.includes(qModel)) {
        return p;
      }
      if (qMake && qMake.includes(pMake) && qModel && qModel.includes(p.focalLength.toString())) {
        return p;
      }
    }

    return null;
  }

  /**
   * Retrieves all available profiles formatted for dropdown selection
   */
  static getProfileList() {
    return this.PROFILES.map(p => ({
      id: p.id,
      name: `${p.make} — ${p.model}`,
      profile: p
    }));
  }
}

if (typeof window !== 'undefined') {
  window.LensProfileDatabase = LensProfileDatabase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LensProfileDatabase };
}
