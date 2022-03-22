/*
Rotary knob events processing logic that converts into a value

Here we're using onoff: https://www.npmjs.com/package/onoff onoff relies on sysfs files located at /sys/class/gpio, 
and https://github.com/smallab/nodary-encoder to read the encoder value
For advanced GPIO, see https://www.npmjs.com/package/pigpio A wrapper for the pigpio C library to enable fast GPIO, PWM, servo control, state change notification and interrupt handling

Others from the same author:
https://github.com/fivdi/i2c-bus
https://github.com/fivdi/spi-device
https://github.com/fivdi/mcp-spi-adc


Note on how the knob is implemented from a source of nodary-encoder: https://github.com/nstansby/rpi-rotary-encoder-python


*/

const Gpio = require('onoff').Gpio;
const dgram = require('dgram');
const { Buffer } = require('buffer');
const { hrtime } = require('process');
const nodaryEncoder = require('nodary-encoder');

const CLICKED_EVENT = "C";

const logEnabled = "1" === process.env.LOG_ENABLED;
const clkPin = process.env.RENC_CLK_GPIO_PIN || 17;
const dtPin = process.env.RENC_DT_GPIO_PIN || 27;
const swPin = process.env.RENC_SW_GPIO_PIN || 22;
const listenerPort = process.env.RENC_LISTENER_PORT || '8001';
const listenerAddress = process.env.RENC_LISTENER_ADDRESS || 'localhost';

logEnabled && console.log("rotary knob starting");
logEnabled && console.log(`Pins: CLK: ${clkPin} DT: ${dtPin} SW: ${swPin}`);
logEnabled && console.log(`listener: listenerAddress: ${listenerAddress} listenerPort: ${listenerPort}`);

const rotEncoder = nodaryEncoder(clkPin, dtPin);
const sw = new Gpio(swPin, 'in', 'raising'); // , {debounceTimeout: 10}

const clientSocket = dgram.createSocket('udp4');

let clicked = false;
let lastClickTime = hrtime.bigint();

let counter = 0;
let swLastState = sw.readSync()

rotEncoder.on('rotation', (direction, value) => {
  if (direction == 'R') {
    logEnabled && console.log('Encoder rotated right');
  } else {
    logEnabled && console.log('Encoder rotated left');
  }
  if ( counter != value ) {
    counter = value;
    sendClickInfo(direction, value);
  }
});


function sendClickInfo(event, value) {
  counter = value;
  logEnabled && console.log("Counter ", counter);
  const lapseInMs = lapseFromLastClick();
  const message = Buffer.alloc(9);
  message.writeUint8(event.charCodeAt(0), 0);
  message.writeInt32BE(value, 1);
  message.writeInt32BE(lapseInMs, 5);
  clientSocket.send(message, listenerPort, listenerAddress, (err) => {
    if ( err ) {
      console.error("Error when sending packet", err)
    }
  });
}

function lapseFromLastClick() {
  if ( !clicked ) {
    clicked = true;
    lastClickTime = hrtime.bigint();
    return 0;
  } else {
    const now = hrtime.bigint();
    const dif = now - lastClickTime;
    const difInt = Number(dif);

    lastClickTime = now;
    const lapseInMs = difInt / 1000000;
    logEnabled && console.log(`Time between clicks: ${lapseInMs} milliseconds`);
    return lapseInMs;
  }
}

function swClicked(value) {
  sendClickInfo(CLICKED_EVENT, value);
}

 
sw.watch((err, value) => {
    if (err) {
      throw err;
    }
    logEnabled && console.log("swClicked ", value);
    swClicked(value);
});


process.on('SIGINT', _ => {
    sw.unexport();
  });

logEnabled && console.log("rotary knob started");

logEnabled && console.log("Initial sw:", swLastState);
logEnabled && console.log("=========================================");

  