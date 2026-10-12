export interface AreaMeasurement {
  squareMeters: number;
  hectares: number;
  squareKilometers: number;
}

/**
 * Calculates physical area from a pixel count and supplied pixel dimensions:
 *   componentArea = componentPixelCount × pixelWidthMeters × pixelHeightMeters
 *   hectares = squareMeters / 10000
 *   squareKilometers = squareMeters / 1000000
 *
 * Never infers geographic area from pixel count alone without explicit pixelWidthMeters and pixelHeightMeters.
 */
export function calculateAreaFromPixels(
  pixelCount: number,
  pixelWidthMeters: number,
  pixelHeightMeters: number
): AreaMeasurement {
  if (
    !Number.isFinite(pixelCount) ||
    pixelCount <= 0 ||
    !Number.isFinite(pixelWidthMeters) ||
    pixelWidthMeters <= 0 ||
    !Number.isFinite(pixelHeightMeters) ||
    pixelHeightMeters <= 0
  ) {
    return {
      squareMeters: 0,
      hectares: 0,
      squareKilometers: 0
    };
  }

  const singlePixelArea = pixelWidthMeters * pixelHeightMeters;
  const squareMeters = Number((pixelCount * singlePixelArea).toFixed(4));
  const hectares = Number((squareMeters / 10000).toFixed(6));
  const squareKilometers = Number((squareMeters / 1000000).toFixed(8));

  return {
    squareMeters,
    hectares,
    squareKilometers
  };
}
