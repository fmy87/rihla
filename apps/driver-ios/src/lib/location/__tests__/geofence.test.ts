import { distanceMeters } from '../geofence';

describe('distanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(distanceMeters(23.588, 58.3829, 23.588, 58.3829)).toBeCloseTo(0, 5);
  });

  it('matches a known distance within a small tolerance (Muscat ~ Seeb, ~18km)', () => {
    // Muscat city center vs. Seeb — real-world distance is roughly 18-20km.
    const d = distanceMeters(23.588, 58.3829, 23.6703, 58.189);
    expect(d).toBeGreaterThan(15000);
    expect(d).toBeLessThan(25000);
  });

  it('is symmetric', () => {
    const a = distanceMeters(23.588, 58.3829, 23.6, 58.4);
    const b = distanceMeters(23.6, 58.4, 23.588, 58.3829);
    expect(a).toBeCloseTo(b, 5);
  });

  it('small offsets stay within a small-scale sanity range (100m geofence use case)', () => {
    // ~0.0009 degrees latitude is roughly 100m.
    const d = distanceMeters(23.588, 58.3829, 23.5889, 58.3829);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
});
