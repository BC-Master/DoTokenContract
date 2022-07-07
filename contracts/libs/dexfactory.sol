// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
// pragma solidity ^0.5.16;

import "hardhat/console.sol";

interface IPancakeSwapFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);
    function init_code_pair_hash() external pure returns(bytes32);


    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs() external view returns (address[] memory);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}

interface IERC20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}

interface IPancakeSwapERC20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external pure returns (string memory);
    function symbol() external pure returns (string memory);
    function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);

    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function PERMIT_TYPEHASH() external pure returns (bytes32);
    function nonces(address owner) external view returns (uint);

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
}

interface IPancakeSwapPair is IPancakeSwapERC20{
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    // function MINIMUM_LIQUIDITY() external view returns (uint);
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint);
    function price1CumulativeLast() external view returns (uint);
    function kLast() external view returns (uint);

    function mint(address to) external returns (uint liquidity);
    function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;

    function initialize(address, address) external;
}

interface IPancakeSwapCallee {
    function PancakeSwapCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

contract PancakeSwapERC20 is IPancakeSwapERC20 {
    using SafeMath for uint;

    string public _name = 'PancakeSwap ';
    string public _symbol = 'Pancake-LP';
    uint8 public _decimals = 18;
    uint  public _totalSupply;
    mapping(address => uint) _balanceOf;
    mapping(address => mapping(address => uint)) _allowance;

    bytes32 _DOMAIN_SEPARATOR;
    // // keccak256("permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint) _nonces;

    constructor() {
        uint chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes(_name)),
                keccak256(bytes('1')),
                chainId,
                address(this)
            )
        );
    }

    function name() external pure override returns (string memory) {
        return "Pancake LP";
    }

    function symbol() external pure override returns (string memory) {
        return "LP Symbol";
    }

    function decimals() external pure override returns (uint8) {
        return 18;
    }

    function totalSupply() external view override returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address owner) external view override returns (uint) {
        return _balanceOf[owner];
    }

    function allowance(address owner, address spender) external view override returns(uint) {
        return _allowance[owner][spender];
    }

    function _mint(address to, uint value) internal {
        _totalSupply = _totalSupply.add(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint value) internal {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _totalSupply = _totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner, address spender, uint value) private {
        _allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint value) private {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external override returns (bool) {
        if (_allowance[from][msg.sender] - value > uint(0)) {
            _allowance[from][msg.sender] = _allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    function DOMAIN_SEPARATOR() external view override returns (bytes32){
        return _DOMAIN_SEPARATOR;
    }

    function PERMIT_TYPEHASH() external pure override returns (bytes32){
        return 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    }

    function nonces(address owner) external view override returns (uint){
        return _nonces[owner];
    }

    function permit(
        address owner, 
        address spender, 
        uint value, 
        uint deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) external override {
        require(deadline >= block.timestamp, 'PancakeSwap: EXPIRED');
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                _DOMAIN_SEPARATOR,
                keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _nonces[owner]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'PancakeSwap: INVALID_SIGNATURE');
        _approve(owner, spender, value);
    }
}

contract PancakeSwapPair is IPancakeSwapPair, PancakeSwapERC20 {
    using SafeMath  for uint;
    using UQ112x112 for uint224;

    uint public constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 public constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public _factory;
    address public _token0;
    address public _token1;

    uint112 private _reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private _reserve1;           // uses single storage slot, accessible via getReserves
    uint32  private _blockTimestampLast; // uses single storage slot, accessible via getReserves

    uint public _price0CumulativeLast;
    uint public _price1CumulativeLast;
    uint public _kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'PancakeSwap: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor() {
        _factory = msg.sender;
    }

    // called once by the factory at time of deployment
    function initialize(address token00, address token11) 
        external override {
        require(msg.sender == _factory, 'PancakeSwap: FORBIDDEN'); // sufficient check
        _token0 = token00;
        _token1 = token11;
    }

    // function MINIMUM_LIQUIDITY() external override pure returns (uint) {
    //     return MINIMUM_LIQUIDITY;
    // }

    function factory() external view override returns (address){
        return _factory;
    }

    function token0() external view override returns (address){
        return _token0;
    }

    function token1() external view override returns (address){
        return _token1;
    }

    function getReserves() 
        public view override
    returns (
        uint112 reserve0, 
        uint112 reserve1, 
        uint32 blockTimestampLast
    ) {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = _blockTimestampLast;
    }

    function price0CumulativeLast() external view override returns (uint) {
        return _price0CumulativeLast;
    }

    function price1CumulativeLast() external view override returns (uint){
        return _price1CumulativeLast;
    }

    function kLast() external view override returns (uint){
        return _kLast;
    }

    function _safeTransfer(
        address token, 
        address to, 
        uint value
    ) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'PancakeSwapFactory: TRANSFER_FAILED');
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(
        uint balance0, 
        uint balance1, 
        uint112 reserve0, 
        uint112 reserve1
    ) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, 'PancakeSwap: OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - _blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && reserve0 != 0 && reserve1 != 0) {
            // * never overflows, and + overflow is desired
            _price0CumulativeLast += uint(UQ112x112.encode(reserve1).uqdiv(reserve0)) * timeElapsed;
            _price1CumulativeLast += uint(UQ112x112.encode(reserve0).uqdiv(reserve1)) * timeElapsed;
        }
        _reserve0 = uint112(balance0);
        _reserve1 = uint112(balance1);
        _blockTimestampLast = blockTimestamp;
        emit Sync(_reserve0, _reserve1);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(
        uint112 reserve0, 
        uint112 reserve1
    ) private returns (bool feeOn) {
        address feeTo = IPancakeSwapFactory(_factory).feeTo();
        feeOn = feeTo != address(0);
        uint kLast11 = _kLast; // gas savings
        if (feeOn) {
            if (kLast11 != 0) {
                uint rootK = Math.sqrt(uint(reserve0).mul(reserve1));
                uint rootKLast = Math.sqrt(kLast11);
                if (rootK > rootKLast) {
                    uint numerator = _totalSupply.mul(rootK.sub(rootKLast));
                    uint denominator = rootK.mul(5).add(rootKLast);
                    uint liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (kLast11 != 0) {
            _kLast = 0;
        }
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) 
        external override lock returns (uint liquidity) {
        (uint112 reserve0, uint112 reserve1,) = getReserves(); // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint amount0 = balance0.sub(reserve0);
        uint amount1 = balance1.sub(reserve1);

        bool feeOn = _mintFee(reserve0, reserve1);
        uint totalSupply = _totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (totalSupply == 0) {
            liquidity = Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
           _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amount0.mul(totalSupply) / reserve0, amount1.mul(totalSupply) / reserve1);
        }
        require(liquidity > 0, 'PancakeSwap: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        _update(balance0, balance1, reserve0, reserve1);
        if (feeOn) _kLast = uint(_reserve0).mul(_reserve1); // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to) 
        external override lock returns (uint amount0, uint amount1) {
        (uint112 reserve0, uint112 reserve1,) = getReserves(); // gas savings
        address token00 = _token0;                                // gas savings
        address token11 = _token1;                                // gas savings
        uint balance0 = IERC20(token00).balanceOf(address(this));
        uint balance1 = IERC20(token11).balanceOf(address(this));
        uint liquidity = _balanceOf[address(this)];

        bool feeOn = _mintFee(reserve0, reserve1);
        uint totalSupply = _totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        amount0 = liquidity.mul(balance0) / totalSupply; // using balances ensures pro-rata distribution
        amount1 = liquidity.mul(balance1) / totalSupply; // using balances ensures pro-rata distribution
        require(amount0 > 0 && amount1 > 0, 'PancakeSwap: INSUFFICIENT_LIQUIDITY_BURNED');
        _burn(address(this), liquidity);
        _safeTransfer(token00, to, amount0);
        _safeTransfer(token11, to, amount1);
        balance0 = IERC20(token00).balanceOf(address(this));
        balance1 = IERC20(token11).balanceOf(address(this));

        _update(balance0, balance1, reserve0, reserve1);
        if (feeOn) _kLast = uint(_reserve0).mul(_reserve1); // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(
        uint amount0Out, 
        uint amount1Out, 
        address to, 
        bytes calldata data
    ) external override lock {
        require(amount0Out > 0 || amount1Out > 0, 'PancakeSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 reserve0, uint112 reserve1,) = getReserves(); // gas savings
        require(amount0Out < reserve0 && amount1Out < reserve1, 'PancakeSwap: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;
        { // scope for _token{0,1}, avoids stack too deep errors
        address token00 = _token0;
        address token11 = _token1;

        require(to != token00 && to != token11, 'PancakeSwap: INVALID_TO');
        if (amount0Out > 0) _safeTransfer(token00, to, amount0Out); // optimistically transfer tokens
        if (amount1Out > 0) _safeTransfer(token11, to, amount1Out); // optimistically transfer tokens
        if (data.length > 0) IPancakeSwapCallee(to).PancakeSwapCall(msg.sender, amount0Out, amount1Out, data);
        balance0 = IERC20(token00).balanceOf(address(this));
        balance1 = IERC20(token11).balanceOf(address(this));
        }
        uint amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'PancakeSwap: INSUFFICIENT_INPUT_AMOUNT');
        { // scope for reserve{0,1}Adjusted, avoids stack too deep errors
        uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
        uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
        require(balance0Adjusted.mul(balance1Adjusted) >= uint(reserve0).mul(reserve1).mul(1000**2), 'PancakeSwap: K');
        }
        _update(balance0, balance1, reserve0, reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // force balances to match reserves
    function skim(address to) external override lock {
        address token00 = _token0; // gas savings
        address token11 = _token1; // gas savings
        _safeTransfer(token00, to, IERC20(token00).balanceOf(address(this)).sub(_reserve0));
        _safeTransfer(token11, to, IERC20(token11).balanceOf(address(this)).sub(_reserve1));
    }

    // force reserves to match balances
    function sync() external override lock {
        _update(IERC20(_token0).balanceOf(address(this)), IERC20(_token1).balanceOf(address(this)), _reserve0, _reserve1);
    }
}

contract PancakeSwapFactory is IPancakeSwapFactory {
    address public _feeTo;
    address public _feeToSetter;

    mapping(address => mapping(address => address)) public _getPair;
    address[] public _allPairs;

    // event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    bytes32 public constant INIT_CODE_PAIR_HASH = keccak256(abi.encodePacked(type(PancakeSwapPair).creationCode));
    
    constructor(address feeToSetterAddress) {
        _feeToSetter = feeToSetterAddress;
    }

    function getPair(address tokenA, address tokenB) 
        external view override returns (address) {
        return _getPair[tokenA][tokenB];
    }

    function allPairs() external view override returns (address[] memory) {
        return _allPairs;
    }

    function allPairsLength() external view override returns (uint) {
        return _allPairs.length;
    }

    function feeTo() external view override returns (address) {
        return _feeTo;
    }

    function feeToSetter() external view override returns (address){
        return _feeToSetter;
    }

    function init_code_pair_hash() external pure override returns(bytes32) {
        return INIT_CODE_PAIR_HASH;
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, 'PancakeSwap: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'PancakeSwap: ZERO_ADDRESS');
        require(_getPair[token0][token1] == address(0), 'PancakeSwap: PAIR_EXISTS'); // single check is sufficient
        bytes memory bytecode = type(PancakeSwapPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IPancakeSwapPair(pair).initialize(token0, token1);
        _getPair[token0][token1] = pair;
        _getPair[token1][token0] = pair; // populate mapping in the reverse direction
        _allPairs.push(pair);
        emit PairCreated(token0, token1, pair, _allPairs.length);
    }

    function setFeeTo(address feeAddress) external override {
        require(msg.sender == _feeTo, 'PancakeSwap: FORBIDDEN');
        _feeTo = feeAddress;
    }

    function setFeeToSetter(address feeToSetterAddress) external override {
        require(msg.sender == _feeToSetter, 'PancakeSwap: FORBIDDEN');
        _feeToSetter = feeToSetterAddress;
    }
}

// a library for performing overflow-safe math, courtesy of DappHub (https://github.com/dapphub/ds-math)

library SafeMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
    }
}

// a library for performing various math operations

library Math {
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

// a library for handling binary fixed point numbers (https://en.wikipedia.org/wiki/Q_(number_format))

// range: [0, 2**112 - 1]
// resolution: 1 / 2**112

library UQ112x112 {
    uint224 constant Q112 = 2**112;

    // encode a uint112 as a UQ112x112
    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112; // never overflows
    }

    // divide a UQ112x112 by a uint112, returning a UQ112x112
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        z = x / uint224(y);
    }
}