package main

import (
	"bytes"
	"log"
	"strconv"

	"github.com/fletaio/common"
	"github.com/fletaio/common/util"
	"github.com/fletaio/core/account"
	"github.com/fletaio/core/amount"
	"github.com/fletaio/core/consensus"
	"github.com/fletaio/core/data"
	"github.com/fletaio/core/transaction"

	_ "github.com/fletaio/extension/account_tx"
	_ "github.com/fletaio/extension/utxo_tx"
	_ "github.com/fletaio/solidity"
)

// consts
const (
	BlockchainVersion = 1
)

// transaction_type transaction types
const (
	// Game Transactions
	CreateAccountTransctionType = transaction.Type(1)
	// Formulation Transactions
	CreateFormulationTransctionType = transaction.Type(60)
	RevokeFormulationTransctionType = transaction.Type(61)
)

// account_type account types
const (
	// Game Accounts
	AccountType = account.Type(1)
	// Formulation Accounts
	FormulationAccountType = account.Type(60)
)

type txFee struct {
	Type transaction.Type
	Fee  *amount.Amount
}

func initChainComponent(act *data.Accounter, tran *data.Transactor) error {
	TxFeeTable := map[string]*txFee{
		"sandbox.CreateAccount":       &txFee{CreateAccountTransctionType, amount.COIN.MulC(10)},
		"consensus.CreateFormulation": &txFee{CreateFormulationTransctionType, amount.COIN.MulC(50000)},
		"consensus.RevokeFormulation": &txFee{RevokeFormulationTransctionType, amount.COIN.DivC(10)},
	}
	for name, item := range TxFeeTable {
		if err := tran.RegisterType(name, item.Type, item.Fee); err != nil {
			log.Println(name, item, err)
			return err
		}
	}

	AccTable := map[string]account.Type{
		"sandbox.Account":              AccountType,
		"consensus.FormulationAccount": FormulationAccountType,
	}
	for name, t := range AccTable {
		if err := act.RegisterType(name, t); err != nil {
			log.Println(name, t, err)
			return err
		}
	}
	return nil
}

var globalAccountAddress = common.MustParseAddress("3HPiADDVt3")

func initGenesisContextData(act *data.Accounter, tran *data.Transactor) (*data.ContextData, error) {
	loader := data.NewEmptyLoader(act.ChainCoord(), act, tran)
	ctd := data.NewContextData(loader, nil)

	acg := &accCoordGenerator{}
	adminPubHash := common.MustParsePublicHash("3oawb1ubDv3tSJdhXDYiM53G58gJPTynVJwDWtbQYy2")
	addUTXO(loader, ctd, adminPubHash, acg.Generate(), CreateAccountChannelSize)
	addFormulator(loader, ctd, common.MustParsePublicHash("2NDLwtFxtrtUzy6Dga8mpzJDS5kapdWBKyptMhehNVB"), common.MustParseAddress("3CUsUpvEK"), "sandbox.fr00001")
	addSingleAccount(loader, ctd, common.MustParsePublicHash("2222222222222222222222222222222222222222222"), globalAccountAddress, "gamestate")
	RegisterAllowedPublicHash(adminPubHash)
	return ctd, nil
}

func addUTXO(loader data.Loader, ctd *data.ContextData, KeyHash common.PublicHash, coord *common.Coordinate, count int) {
	var rootAddress common.Address
	for i := 0; i < count; i++ {
		id := transaction.MarshalID(coord.Height, coord.Index, uint16(i))
		ctd.CreateUTXO(id, &transaction.TxOut{Amount: amount.NewCoinAmount(0, 0), PublicHash: KeyHash})
		ctd.SetAccountData(rootAddress, []byte("utxo"+strconv.Itoa(i)), util.Uint64ToBytes(id))
	}
}

func addSingleAccount(loader data.Loader, ctd *data.ContextData, KeyHash common.PublicHash, addr common.Address, name string) {
	a, err := loader.Accounter().NewByTypeName("sandbox.Account")
	if err != nil {
		panic(err)
	}
	acc := a.(*Account)
	acc.Address_ = addr
	acc.Name_ = name
	acc.Balance_ = amount.NewCoinAmount(10000000000, 0)
	acc.KeyHash = KeyHash
	ctd.CreatedAccountMap[acc.Address_] = acc

	const width = 64
	const height = 64
	const elements = width * height

	cells := make([]PictureCell, elements)

	for i := range cells{
		cells[i] = PictureCell{uint64(i), 0, 0}
	}

	gd := NewGameDataWithBoard(PictureBoard{
		Width: 64,
		Height: 64,
		Cells: cells,
	})

	var buffer bytes.Buffer
	if _, err := gd.WriteTo(&buffer); err != nil {
		panic(err)
	}

	ctd.SetAccountData(addr, []byte("game"), buffer.Bytes())
}

func addFormulator(loader data.Loader, ctd *data.ContextData, KeyHash common.PublicHash, addr common.Address, name string) {
	a, err := loader.Accounter().NewByTypeName("consensus.FormulationAccount")
	if err != nil {
		panic(err)
	}
	acc := a.(*consensus.FormulationAccount)
	acc.Address_ = addr
	acc.Name_ = name
	acc.Balance_ = amount.NewCoinAmount(0, 0)
	acc.KeyHash = KeyHash
	ctd.CreatedAccountMap[acc.Address_] = acc
}

type accCoordGenerator struct {
	idx uint16
}

func (acg *accCoordGenerator) Generate() *common.Coordinate {
	coord := common.NewCoordinate(0, acg.idx)
	acg.idx++
	return coord
}
