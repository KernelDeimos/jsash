# Busybox sh shell port to javascript

This is an attempt to port a [POSIX-compliant](https://pubs.opengroup.org/onlinepubs/009604499/utilities/xcu_chap02.html)
shell to javascript.

The reference being used is `ash` as found in the repository for
[busybox](https://github.com/brgl/busybox)
because at just over 14000 lines of C code it's relatively simple.
It may have been simpler to go with `sh` from [UNIX V6](https://github.com/seosgithub/sh_unix_v6)
at under 1000 lines, but you know what they say about hindsight.

## Why

I'm curious how difficult it will be

## Approach

- C strings (char pointers) are ported to native javascript strings
- Relationships between functions and state variables are carefully
  modelled so side-effects can be tracked
- All functions become parametric functions
- Javascript code will not have side effects other than those which
  are explicitly modelled
- It should be possible to use a function in isolation by overriding
  imports of constants, state, other functions, etc.
- The javascript code body of a ported function should be "pure logic",
  making it possible to transpile to other languages in the future
  without the need for further porting.

## What happens if this is completely successful?

- A POSIX-compliant shell than can be used anywhere javascript can run.
- Transpile back to C for a real POSIX shell that my generation can understand.
