# Rotary reader

Rotary-reader provides an easy way to integrate a rotary encoder into your application. Instead of importing a library and handling the GPIO events, you can include this block as a container and listen for the events it generates.


Rotary-reader decodes the clicks from a rotary encoder, detects the rotation direction, tracks the position using an integer, and publishes this info by sending UDP datagrams with the encoded data.

Each time a new event occurs ( rotating the knob clockwise, rotating it counterclockwise or pushing the knob ), the reader sends a new packet to the configured IP address and port.

The packet format is:

length: 9 bytes

| Position      | Length | Value     | Description |
|:---:|:----:|:---:|:---|
| 0   | 1 byte       | 0x43 ( dec 67 )   | **C**lick pushed |
| 0   | 1 byte       | 0x4C ( dec 76 )   | **L**eft ( counterclockwise ) pulse |
| 0   | 1 byte       | 0x52 ( Dec 82 )   | **R**ight ( clockwise ) pulse |
| 1   | 4 bytes ( signed int 32 bits BE )  |   value    | updated value value |
| 5   | 4 bytes  ( signed int 32 bits BE ) |  lapse     | milleseconds ellapsed since the last click. Can be used to calculate the velocity on a sequence of clicks |

## Usage

### docker-compose file

To use this image, create a container in your `docker-compose.yml` file as shown below:

```yaml
version: '2'
services:
  rotary-reader:  # You could create more than one if needed
    image: bhcr.io/ramiro_gonzalez/rotary-knob:raspberrypi4-64-latest  # See available tags at https://hub.docker.com/repository/docker/ramirogmbalena/rotary-reader/tags?page=1&ordering=last_updated
    privileged: true
    environment: 
      - RENC_LISTENER_ADDRESS=app  # see the app container
      - RENC_LISTENER_PORT=8001  # see the app container
      - RENC_CLK_GPIO_PIN=17
      - RENC_DT_GPIO_PIN=27
      - RENC_SW_GPIO_PIN=22
      - LOG_ENABLED=1   # any value != 1 turns off the logging to console
  app:
    build: ./app
    expose:
      - "8001"    # rotary-reader will send UDP packets to this port
```

Now on your app you can listen to the UDP datagrams. For example, in a node app:

```javascript
const rotaryReaderListener = dgram.createSocket('udp4');

function decodeMessage(buffer) {
  let event, value, lapse;
  event = buffer[0];
  value = buffer.readInt32BE(1);
  lapse = buffer.readInt32BE(5);
  return { event, value, lapse};
}

rotaryReaderListener.on('error', (err) => {
  console.log(`rotaryReaderListener error:\n${err.stack}`);
  rotaryReaderListener.close();
  process.exit(1);
});

rotaryReaderListener.on('message', (msg, rinfo) => {
  const {event, value, lapse} = decodeMessage(msg);
  console.log(`decoded message. event: ${event} value: ${value} lapse: ${lapse}`);
});

rotaryReaderListener.on('listening', () => {
  const address = rotaryReaderListener.address();
  console.log(`rotaryReaderListener listening ${address.address}:${address.port}`);
});

rotaryReaderListener.bind(8001);

```


## Details

This block is a node.js app that uses two libraries to read the events,  `nodary-encoder` and `onoff`.

## TO DO

- Add a bit of debounce. Would need to fork nodary-encoder to add this parameter to the constructor


## Configuration

The rotary-reader works with the following environment variables:

| Env Var | Description | Default |
|:---|:----|:---|
| RENC_LISTENER_ADDRESS| Address where the datagrams are sent to | localhost |
| RENC_LISTENER_PORT| Port on that address| 8001 |
| RENC_CLK_GPIO_PIN| GPIO pin where the rotary encoder CLK pin is wired to | 17 |
| RENC_DT_GPIO_PIN| Same for the DT pin| 27 |
| RENC_SW_GPIO_PIN| Same for the SW pin| 22 |
| LOG_ENABLED| Log to console if == 1 | null ( no logging )


## References

This block can be used as a software replacement for https://learn.adafruit.com/adafruit-i2c-qt-rotary-encoder , but instead of providing an I2C interface it uses UDP datagrams.


