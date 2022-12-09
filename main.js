class Registry {
    constructor () {
        this.data_ = [];

        [
            'Function',
            'Constants',
            'Enum',
        ].forEach(name => {
            this['register'+name] = function (model) {
                this.data_.push({
                    ...model,
                    $: name
                })
            }
        })
    }

    getFunction(id, boundParameters) {
        let fm = this.data_.find(
            model => model.$ == 'Function' &&
            model.id == id
        );

        if ( ! fm ) throw new Error('not found: $Function:' + id);

        const binds = {};

        for ( const key in fm.properties ) {
            const propModel = fn.properties[key];
            if ( propModel === 'Function' ) {
                binds[key] = function () {};
            }
        }

        for ( const imp of fm.imports ) {
            const source = this.data_.find(model => model.id == imp.from);
            
            // TODO: different behaviour for splat=false

            if ( source.$ == 'Constants' ) {
                for ( let k in source.values ) {
                    binds[k] = source.values[k].value;
                }
                continue;
            }

            if ( source.$ == 'Enum' ) {
                for ( let i = 0 ; i < source.values.length ; i++ ) {
                    binds[source.values[i]] = i;
                }
                continue;
            }
        }

        // INTENTION: boundParameters allows overriding imports
        if ( boundParameters ) for ( let k in boundParameters ) {
            binds[k] = boundParameters[k];
        }

        const fn = function (o) {
            o = {
                ...binds,
                ...o
            };
            return fm.code(o);
        }

        Object.defineProperty(fn, 'name', {
            value: fm.code.name + '$softbound'
        })

        return fn;
    }
}

const r = new Registry();

r.registerConstants({
    id: 'ash-syntax-classes',
    name: 'ash syntax classes',
    values: {
        CWORD: { value: 0, comment: 'character is nothing special' },
        CNL: { value: 1, comment: 'newline character' },
        CBACK: { value: 2, comment: 'a backslash character' },
        CSQUOTE: { value: 3, comment: 'single quote' },
        CDQUOTE: { value: 4, comment: 'double quote' },
        CENDQUOTE: { value: 5, comment: 'a terminating quote' },
        CBQUOTE: { value: 6, comment: 'backwards single quote' },
        CVAR: { value: 7, comment: 'a dollar sign' },
        CENDVAR: { value: 8, comment: 'a \'}\' character' },
        CLP: { value: 9, comment: 'a left paren in arithmetic' },
        CRP: { value: 10, comment: 'a right paren in arithmetic' },
        CENDFILE: { value: 11, comment: 'end of file' },
        CCTL: { value: 12, comment: 'like CWORD, except it must be escaped' },
        CSPCL: { value: 13, comment: 'these terminate a word' },
        CIGN: { value: 14, comment: 'character should be ignored' },
        PEOF: { value: 256, comment: 'end of file' }
    }
})

r.registerEnum({
    id: 'token-enum',
    values: [
        'TEOF',
        'TNL',
        'TREDIR',
        'TWORD',
        'TSEMI',
        'TBACKGND',
        'TAND',
        'TOR',
        'TPIPE',
        'TLP',
        'TRP',
        'TENDCASE',
        'TENDBQUOTE',
        'TNOT',
        'TCASE',
        'TDO',
        'TDONE',
        'TELIF',
        'TELSE',
        'TESAC',
        'TFI',
        'TFOR',
        'TIF',
        'TIN',
        'TTHEN',
        'TUNTIL',
        'TWHILE',
        'TBEGIN',
        'TEND',
        // IF: BASH_FUNCTION - was between TFOR and TIF
        'TFUNCTION'
    ]
})

r.registerFunction({
    id: 'xxreadtoken',
    imports: [
        { from: 'ash-syntax-classes'    , splat: true },
        { from: 'token-enum'            , splat: true },
    ],
    parametric: true,
    source: {
        $: 'port.manual',
        uri: 'https://github.com/brgl/busybox/blob/master/shell/ash.c',
    },
    notes: [
        'port: lasttoken side effect omitted',
        'port: PEOA check omitted',
        'port: bash redirect (&>) omitted',
    ],
    parameters: {
        pgetc: 'Function',
        pungetc: 'Function',
        readtoken1: 'Function',
        nlprompt: 'Function',
        nlnoprompt: 'Function',
    },
    code: function xxreadtoken ({
        // character reading
        pgetc,
        pungetc,
        readtoken1,
        // writing
        nlprompt,
        nlnoprompt,
        // ash-syntax-classes
        PEOF,
        // token-enum
        TNL, TLP, TRP,
        TBACKGND, TPIPE, TSEMI,
        TEOF,
        TAND, TOR, TENDCASE
    }) {
        const singles = ['\n', '(', ')'];
        const doubles = ['&', '|', ';'];
        const chars   = [...singles, ...doubles];

        const tokens = [
            TNL, TLP, TRP,          /* only single occurrence allowed */
            TBACKGND, TPIPE, TSEMI, /* if single occurrence */
            TEOF,                   /* corresponds to trailing nul */
            TAND, TOR, TENDCASE     /* if double occurrence */
        ];

        for (;;) {
            let c = pgetc();

            // port: part of condition omitted; see notes
            if ( c == ' ' || c == '\t' ) {
                continue;
            }

            if ( c == '#' ) {
                while ((c = pgetc()) != '\n' && c != PEOF)
                    continue
            } else if ( c == '\\' ) {
                if ( pgetc() != '\n' ) {
                    pungetc();
                    break;
                }
                nlprompt();
            } else {
                let p = chars.length - 1;

                if ( c != PEOF ) {
                    if ( c == '\n' ) {
                        nlnoprompt();
                    }

                    p = chars.indexOf(c);

                    if ( p == -1 ) {
                        break; // return readtoken1(...)
                    }

                    if ( p >= singles.length ) {
                        let cc = pgetc();
                        if ( cc == c ) {
                            p += doubles.length + 1;
                        } else {
                            pungetc();
                            // port: bash &> omitted; see notes
                        }
                    }
                }

                return tokens[p];
            }

            return readtoken1(c, BASESYNTAX, null, 0);
        }
    }
});


const xxreadtoken = r.getFunction('xxreadtoken')

function getStream (str) {
    let pos = 0;
    return {
        pgetc () {
            let i = pos;
            pos++;
            if ( i == str.length ) {
                return 256;
            }
            return str[i];
        },
        pungetc () {
            pos--;
        }
    };
}

class Assert {
    logFail (type, vals) {
        let msg = type + ': ' + JSON.stringify(vals);
        console.log("\x1B[31;1mTEST FAIL: \x1B[0m" + msg);
    }
    logPass (type, vals) {
        let msg = type + ': ' + JSON.stringify(vals);
        console.log("\x1B[32;1mTEST PASS: \x1B[0m" + msg);
    }
    equal (a, b) {
        if ( a !== b ) {
            this.logFail('equal', { a, b })
            return;
        }
        this.logPass('equal', { a, b })
    }
}

const assert = new Assert();

const result = xxreadtoken({
    pgetc: () => '('
});

assert.equal(9, xxreadtoken({
    ...getStream('(')
}))

assert.equal(8, xxreadtoken({
    ...getStream('|')
}))

assert.equal(8, xxreadtoken({
    ...getStream('|x')
}))

assert.equal(7, xxreadtoken({
    ...getStream('||')
}))