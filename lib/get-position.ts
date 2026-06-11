import * as Location from 'expo-location';

/**
 * Get the device position: try a fresh GPS fix (bounded by a timeout),
 * fall back to the last known position. A recent cached fix is far
 * better than an error — fresh fixes regularly time out indoors,
 * where shop owners are when they register.
 */
export async function getCurrentPosition(
  timeoutMs = 10000,
): Promise<Location.LocationObject> {
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('location timeout')), timeoutMs),
      ),
    ]);
  } catch (err) {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60_000,
    });
    if (last) return last;
    throw err;
  }
}
