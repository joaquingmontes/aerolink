# X-Plane setup

X-Plane sends telemetry over UDP; there is nothing to install in the simulator.

1. In X-Plane open **Settings > Data Output**.
2. Tick **Send network data output** for these rows:
   - **3**: speeds
   - **4**: Mach, VVI, G-load
   - **17**: pitch, roll, headings
   - **20**: latitude, longitude, altitude
3. Under **Send network data output** set **IP address** `127.0.0.1` and **port** `49000`.
4. Start AeroLink. The agent logs `Listening for X-Plane data output on UDP 49000`.

To use another port, start the agent with `--xplane-port <n>` and set the same port in X-Plane.

If the aircraft does not appear, check that all four rows are ticked: the agent only publishes once it has received a position (row 20).

Over Data Output X-Plane provides position, attitude and speeds only. Aircraft title, gear, flaps, fuel, engines, radios and autopilot are not available there, so those fields are omitted for X-Plane for now.
