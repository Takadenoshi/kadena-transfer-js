//UTILITY FUNCTIONS
const mkReq = cmd => {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(cmd),
  };
};

const is_hexadecimal = str => {
  const regexp = /^[0-9a-fA-F]+$/;
  if (regexp.test(str)) return true;
  else return false;
};

const convertDecimal = decimal => {
  decimal = decimal.toString();
  if (decimal.includes('.')) {
    return decimal;
  }
  if (decimal / Math.floor(decimal) === 1) {
    decimal = decimal + '.0';
  }
  return decimal;
};

const createTime = () => Math.round(new Date().getTime() / 1000) - 50;

const checkKey = key => {
  if (key.length !== 64) {
    throw 'Key does not have length of 64';
  } else if (!is_hexadecimal(key)) {
    throw 'Key is not hex string';
  }
  return true;
};

const checkSecretKey = key => {
  if (key.length !== 64 && key.length !== 128) {
    throw 'Key does not have the correct length';
  } else if (!is_hexadecimal(key)) {
    throw 'Key is not hex string';
  }
  return true;
};

async function getVersion(server) {
  try {
    const nodeInfo = await fetch(`https://${server}/info`);
    const nodeInfoJSON = await nodeInfo.json();
    return nodeInfoJSON.nodeVersion;
  } catch (e) {
    throw e;
  }
}

async function verifyNode(node) {
  return getVersion(node)
    .then(networkId => {
      document.getElementById('networkId').classList.remove('red');
      document.getElementById('networkId').textContent = networkId;
    })
    .catch(e => {
      document.getElementById('networkId').classList.add('red');
      document.getElementById('networkId').textContent = 'Not a Chainweb Node';
    });
}

//TRANSFER FUNCTIONS
const sendNonJson = async function (cmd, apiHost) {
  var c;
  if (!apiHost) throw new Error(`Pact.fetch.send(): No apiHost provided`);
  c = Pact.simple.cont.createCommand(
    cmd.keyPairs,
    cmd.nonce,
    cmd.step,
    cmd.pactId,
    cmd.rollback,
    cmd.envData,
    cmd.meta,
    cmd.proof,
    cmd.networkId,
  );
  const txRes = await fetch(`${apiHost}/api/v1/send`, mkReq(c));
  return txRes;
};

async function findSrcChain() {
  let requestKey = document.getElementById('pact-id').value.trim();
  const pactId =
    requestKey.length === 44 ? requestKey.slice(0, 43) : requestKey;
  const server = document.getElementById('server').value;
  const networkId = document.getElementById('networkId').textContent;
  console.log(networkId);
  const pact = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
  ].reduce(async (arr, chainId) => {
    arr = await arr;
    const host = `https://${server}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
    const pactInfo = await Pact.fetch.poll({ requestKeys: [pactId] }, host);
    if (pactInfo[pactId]) {
      arr.push({ chainId: chainId, tx: pactInfo[pactId] });
    }
    return arr;
  }, []);
  return pact;
}

async function getPact() {
  let requestKeys = await findSrcChain();
  document.getElementById('pact-info').hidden = true;
  if (requestKeys.length === 0) {
    document
      .getElementById('pact-message')
      .setAttribute('class', 'ui compact message');
    document.getElementById('pact-header').textContent =
      'Request Key could not be found';
  } else {
    try {
      let source = requestKeys[0].chainId;
      let tx = requestKeys[0].tx;
      let [sender, receiver, g, target, amount] =
        tx.continuation.continuation.args;
      document
        .getElementById('pact-message')
        .setAttribute('class', 'ui compact message');
      document.getElementById('pact-header').textContent = 'Pact Information';
      document.getElementById('pact-info').hidden = false;
      document.getElementById('source-chain-id').textContent = source;
      document.getElementById('target-chain-id').textContent = target;
      document.getElementById('sender').textContent = sender;
      document.getElementById('receiver').textContent = receiver;
      document.getElementById('rg').textContent = JSON.stringify(g);
      document.getElementById('amount').textContent = amount;
      enableSubmit();
    } catch (e) {
      document
        .getElementById('pact-message')
        .setAttribute('class', 'ui compact message');
      document.getElementById('pact-header').textContent =
        'Not a Cross Chain Request Key';
    }
  }
}

var getProof = async function () {
  const chainId = document.getElementById('source-chain-id').textContent;
  const targetChainId = document.getElementById('target-chain-id').textContent;
  let requestKey = document.getElementById('pact-id').value.trim();
  const pactId =
    requestKey.length === 44 ? requestKey.slice(0, 43) : requestKey;
  const spvCmd = { targetChainId: targetChainId, requestKey: pactId };
  const server = document.getElementById('server').value;
  const networkId = document.getElementById('networkId').textContent;
  const host = `https://${server}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
  try {
    const res = await fetch(`${host}/spv`, mkReq(spvCmd));
    let foo = await res;
    if (foo.ok) {
      const proof = await res.json();
      return proof;
    } else {
      const proof = await res.text();
      //Initial Step is not confirmed yet.
      throw proof;
    }
  } catch (e) {
    throw 'Initial transfer is not confirmed yet. Please wait and try again.';
  }
};

const handleResult = async function (res) {
  foo = await res;
  hideSpinner();
  if (foo.ok) {
    showStatusBox();
    j = await res.json();
    var reqKey = j.requestKeys[0];
    document.getElementById('status-message').textContent =
      'Transaction Pending...';
    document.getElementById('reqkey-box').hidden = false;
    document.getElementById('request-key').textContent = reqKey;
    listen();
  } else {
    showNegativeStatusBox();
    t = await res.text();
    document.getElementById('reqkey-box').hidden = true;
    document.getElementById('status-message').textContent = t;
  }
};

async function listen() {
  document.getElementById('listen-button').disabled = false;
  showSpinner();
  const chainId = document.getElementById('target-chain-id').textContent;
  const server = document.getElementById('server').value;
  const networkId = document.getElementById('networkId').textContent;
  const reqKey = document.getElementById('request-key').textContent;
  Pact.fetch
    .listen(
      { listen: reqKey },
      `https://${server}/chainweb/0.0/${networkId}/chain/${chainId}/pact`,
    )
    .then(res => {
      console.log(res);
      if (res.result.status === 'success') {
        document.getElementById('status-message').textContent =
          'TRANSFER SUCCEEDED';
        document.getElementById('status-error').textContent = '';
        localStorage.removeItem('xchain-requestKey');
        localStorage.removeItem('xchain-server');
      } else {
        document.getElementById('status-message').textContent =
          'TRANSFER FAILED with error';
        document.getElementById('status-error').textContent = JSON.stringify(
          res.result.error.message,
        );
      }
    });
}

async function finishXChain() {
  disableSubmit();
  try {
    const proof = await getProof();
    const targetChainId =
      document.getElementById('target-chain-id').textContent;
    let requestKey = document.getElementById('pact-id').value.trim();
    const pactId =
      requestKey.length === 44 ? requestKey.slice(0, 43) : requestKey;
    const server = document.getElementById('server').value;
    const networkId = document.getElementById('networkId').textContent;
    const host = `https://${server}/chainweb/0.0/${networkId}/chain/${targetChainId}/pact`;
    const gasStation = 'kadena-xchain-gas';
    const gasLimit = 750;
    const testnetGasPrice = 0.00000001;
    const mainnetGasPrice = 0.00000001;
    const gasPrice =
      networkId === 'testnet04' ? testnetGasPrice : mainnetGasPrice;
    const m = Pact.lang.mkMeta(
      gasStation,
      targetChainId,
      gasPrice,
      gasLimit,
      createTime(),
      28800,
    );
    const contCmd = {
      type: 'cont',
      keyPairs: [],
      pactId: pactId,
      rollback: false,
      step: 1,
      meta: m,
      proof: proof,
      networkId: networkId,
    };
    try {
      const result = await sendNonJson(contCmd, host);
      handleResult(result);
      document.getElementById('result-message').textContent =
        JSON.stringify(result);
    } catch (e) {
      setError(e);
    }
  } catch (e) {
    setError(e);
  }
}

//UI FUNCTIONS
function disableSubmit() {
  document.getElementById('submit-button').disabled = true;
}

function enableSubmit() {
  document.getElementById('submit-button').disabled = false;
}

$(function () {
  $('.ui.dropdown').dropdown();
});

function showNegativeStatusBox() {
  document
    .getElementById('status-box')
    .setAttribute('class', 'ui compact negative message result');
}

function showStatusBox() {
  document.getElementById('listen-button').disabled = true;
  document
    .getElementById('status-box')
    .setAttribute('class', 'ui compact message result');
}

function hideStatusBox() {
  document
    .getElementById('status-box')
    .setAttribute('class', 'ui compact message result hidden');
}

function showSpinner() {
  //document.getElementById('pending-spinner').setAttribute("class", "ui dimmer active");
}

function hideSpinner() {
  //document.getElementById('pending-spinner').setAttribute("class", "ui dimmer");
}

function clearError() {
  document.getElementById('acct-err').innerText = '';
  document.getElementById('kadena-form').setAttribute('class', 'ui form');
}

function setError(msg) {
  document.getElementById('acct-err').innerText = msg;
  document.getElementById('kadena-form').setAttribute('class', 'ui form error');
}

function hasValue(elId) {
  v = document.getElementById(elId).value;
  return v && v.length > 0;
}

function complete() {
  let requestKey = document.getElementById('pact-id').value.trim(); //remove whitespace
  hideStatusBox();
  return (
    document.getElementById('networkId').textContent !==
      'Not a Chainweb Node' &&
    (requestKey.length === 43 ||
      (requestKey.length === 44 && requestKey[43] === '='))
  );
}

function validateServer() {
  document.getElementById('server').addEventListener(
    'blur',
    function (event) {
      clearError();
      hideStatusBox();
      try {
        val = event.srcElement.value;
        if (val !== null && val !== '') {
          verifyNode(val).then(() => {
            if (complete()) getPact();
            else
              document
                .getElementById('pact-message')
                .setAttribute('class', 'ui compact message hidden');
          });
        }
      } catch (err) {
        console.log(err);
        disableSubmit();
        setError(err);
      }
    },
    false,
  );
}

function validatePact() {
  clearError();
  hideStatusBox();
  document.getElementById('pact-id').addEventListener(
    'input',
    function (event) {
      val = event.srcElement.value;
      try {
        if (complete()) getPact();
        else
          document
            .getElementById('pact-message')
            .setAttribute('class', 'ui compact message hidden');
      } catch (err) {
        console.log(err);
        disableSubmit();
        setError(err);
      }
    },
    false,
  );
}

// INITIATION FUNCTIONS
window.addEventListener(
  'load',
  function (event) {
    if (localStorage.getItem('xchain-server')) {
      document.getElementById('server').value =
        localStorage.getItem('xchain-server');

      verifyNode(localStorage.getItem('xchain-server')).then(() => {
        if (localStorage.getItem('xchain-requestKey')) {
          document.getElementById('pact-id').value =
            localStorage.getItem('xchain-requestKey');
          getPact();
        }
      });
    } else {
      document.getElementById('server').value = 'api.chainweb.com';
      document.getElementById('networkId').textContent = 'mainnet01';
    }
    validateServer();
    validatePact();
    document.getElementById('submit-button').addEventListener(
      'click',
      async function (event) {
        event.preventDefault();
        finishXChain();
      },
      false,
    );
    document.getElementById('listen-button').addEventListener(
      'click',
      async function (event) {
        event.preventDefault();
        listen();
      },
      false,
    );
  },
  false,
);
