"use strict";

class Game_SelfSwitches {

    constructor() {
        this.data = {};
    }


    makeKey(mapId, eventId, letter) {

        return `${mapId}:${eventId}:${letter}`;
    }


    value(mapId, eventId, letter) {

        const key =
            this.makeKey(
                mapId,
                eventId,
                letter
            );

        return this.data[key] === true;
    }


    setValue(
        mapId,
        eventId,
        letter,
        value
    ) {

        const key =
            this.makeKey(
                mapId,
                eventId,
                letter
            );


        this.data[key] =
            Boolean(value);


        console.log(
            `Self Switch ${key} = ${this.data[key]}`
        );
    }


    clear() {

        this.data = {};
    }
}
