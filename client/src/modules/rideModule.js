let rideSession = null;
const MIN_ACCEPTED_ACCURACY_METERS = 30;

function getGeolocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("location_unavailable");
  }

  return navigator.geolocation;
}

function readInitialPosition(options) {
  return new Promise((resolve, reject) => {
    const geolocation = getGeolocation();
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function watchPosition(options, onPosition, onError) {
  const geolocation = getGeolocation();
  return geolocation.watchPosition(onPosition, onError, options);
}

function createPositionPoint(position) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: position.timestamp,
    accuracy: position.coords.accuracy ?? null
  };
}

function shouldStorePosition(position) {
  const accuracy = position?.coords?.accuracy;
  if (typeof accuracy !== "number") return true;
  return accuracy < MIN_ACCEPTED_ACCURACY_METERS;
}

function notifyLocationWarning(onLocationWarning, payload) {
  onLocationWarning?.(payload);
}

export async function startRideSession(callbacks = {}) {
  const { onLocationWarning } = callbacks;
  const geolocationOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000
  };

  try {
    const initialPosition = await readInitialPosition(geolocationOptions);

    const acceptedInitialPosition = shouldStorePosition(initialPosition);
    if (!acceptedInitialPosition) {
      notifyLocationWarning(onLocationWarning, {
        type: "low_accuracy",
        accuracy: initialPosition?.coords?.accuracy ?? null
      });
    }

    rideSession = {
      startTime: Date.now(),
      coordinates: acceptedInitialPosition ? [createPositionPoint(initialPosition)] : [],
      watcher: null
    };

    rideSession.watcher = watchPosition(
      geolocationOptions,
      (position) => {
        if (!rideSession) return;
        if (!shouldStorePosition(position)) {
          notifyLocationWarning(onLocationWarning, {
            type: "low_accuracy",
            accuracy: position?.coords?.accuracy ?? null
          });
          return;
        }
        rideSession.coordinates.push(createPositionPoint(position));
      },
      (error) => {
        if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
          endRideSession().catch(() => null);
          return;
        }

        notifyLocationWarning(onLocationWarning, {
          type: "gps_unstable",
          code: error?.code ?? null
        });
      }
    );

    return rideSession;
  } catch (error) {
    if (error?.code === error?.PERMISSION_DENIED || error?.code === 1) {
      throw new Error("location_permission_denied");
    }
    notifyLocationWarning(onLocationWarning, {
      type: "gps_unstable",
      code: error?.code ?? null
    });
    throw new Error("location_unavailable");
  }
}

export async function endRideSession() {
  if (!rideSession) return null;

  if (rideSession.watcher !== null) {
    getGeolocation().clearWatch(rideSession.watcher);
  }

  const finished = { ...rideSession, endTime: Date.now() };
  rideSession = null;
  return finished;
}

export function getCurrentSession() {
  return rideSession;
}
