# Vanity Eth
Nodejs based tool to generate vanity ethereum addresses

# Features!
* Generate multiple addresses
* Supports Multi-core processors
* vanity contract address
* faster, uses less memory, and has more status information than the upstream repository

### Examples
Generate ethereum address:
```sh
$ pnpm run start
```

generate 10 ethereum addresses:
```sh
$ pnpm run start -n 10
```

generate 10 ethereum addresses starting with "dead" and ending with "beef":
```sh
$ pnpm run start -n 10 -p dead -s beef
```

generate 10 ethereum addresses starting with "dead" and ending with "beef", using 8 threads:
```sh
$ pnpm run start -n 10 -p dead -s beef -t 8
```

generate ethereum address with vanity contract address:
```sh
$ pnpm run start -p dead -s beef --contract
```

help me
```sh
$ pnpm run start -h
```

### Running Locally
To run from source:
```sh
git clone git@github.com:Cat7373/VanityEth.git
cd VanityEth
pnpm install
pnpm run start
```

License
----
MIT
