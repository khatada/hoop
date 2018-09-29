import * as winston from "winston";

const logger = winston.createLogger({
    exitOnError: false,
    level: "info",
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(nfo => {
                    return `${nfo.timestamp} ${nfo.level}: ${nfo.message}`;
                })
            ),
            handleExceptions: true
        })
    ]
});

export default logger;