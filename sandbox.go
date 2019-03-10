package main

import (
	"errors"
	"io"
	"log"
	"bytes"

	"encoding/gob"
	"github.com/fletaio/common/util"
	"github.com/fletaio/core/amount"
	"github.com/fletaio/core/data"
	"github.com/fletaio/core/transaction"
)

//////////////////////////////////////////////////////////////////////
// Sandbox Area Begin
//////////////////////////////////////////////////////////////////////

// consts
const (
	GameCommandChannelSize = 1000
)

// errors
var (
	ErrInvalidCount = errors.New("invalid count")
)

type WebAddCountReq struct {
	UTXO  uint64 `json:"utxo"` // DO NOT CHANGE
	Count int    `json:"count"`
}

type WebPaintReq struct {
	UTXO uint64   `json:"utxo"`
	X uint64      `json:"x"`
	Y uint64      `json:"y"`
	Color uint64  `json:"color"`
	Amount uint64 `json:"amount"`
}

type WebNotify struct {
	Height int    `json:"height"` // DO NOT CHANGE
	Type   string `json:"type"`   // DO NOT CHANGE
	Count  int    `json:"count"`
	UTXO   int    `json:"utxo"`  // DO NOT CHANGE
	Error  string `json:"error"` // DO NOT CHANGE
}

type PaintNotify struct {
	Type   string `json:"type"`
	X	    uint64 `json:"x"`
	Y	    uint64 `json:"y"`
	Color  uint64 `json:"color"`
	Amount uint64 `json:"amount"`
}

type BalanceNotify struct {
	Type            string `json:"type"`
	MyBalance       uint64 `json:"my_balance"`
	ContractBalance uint64 `json:"contract_balance"`
}

type WebGameRes struct {
	Height int `json:"height"` // DO NOT CHANGE
	Count  int `json:"count"`
	PictureBoard PictureBoard `json:"board"`
}

// transaction_type transaction types
const (
	// You can define [11 - 59] Transaction type
	// In sandbox, Transaction fee is not calculated
	// Game Transactions
	AddCountTransactionType = transaction.Type(11)
	PaintTransactionType = transaction.Type(12)
)

func initSandboxComponent(act *data.Accounter, tran *data.Transactor) error {
	TxFeeTable := map[string]*txFee{
		"sandbox.AddCount": &txFee{AddCountTransactionType, amount.COIN.MulC(10)},
		"sandbox.Paint": &txFee{PaintTransactionType, amount.COIN.MulC(10)},
		// ADD YOUR OWN TRANSACTION TO HERE
	}
	for name, item := range TxFeeTable {
		if err := tran.RegisterType(name, item.Type, item.Fee); err != nil {
			log.Println(name, item, err)
			return err
		}
	}
	return nil
}

// GameData stores all data of the game
type GameData struct {
	Count uint64
	Board PictureBoard
}

type PictureCell struct {
	Color uint64
	Price uint64
	CreationTime uint64
}

type PictureBoard struct {
	Width uint64
	Height uint64
	Cells []PictureCell
}

var EmptyBoard = &PictureBoard{
	Width: 0,
	Height: 0,
	Cells: []PictureCell{},
}

// NewGameData returns a GameData
func NewGameData() *GameData {
	return NewGameDataWithBoard(*EmptyBoard)
}

func NewGameDataWithBoard(board PictureBoard) *GameData {
	gd := &GameData{
		Count: 0,
		Board: board,
	}
	return gd
}

func (pb *PictureBoard) WriteTo(w io.Writer) (int64) {
	var board bytes.Buffer
	encoder := gob.NewEncoder(&board)

	encoder.Encode(*pb)
	n, err := util.WriteBytes(w, board.Bytes())
	if err != nil {
		panic(err)
	}
	return n
}

// WriteTo is a serialization function
func (gd *GameData) WriteTo(w io.Writer) (int64, error) {
	var wrote int64
	if n, err := util.WriteUint64(w, gd.Count); err != nil {
		return wrote, err
	} else {
		wrote += n
	}

	wrote += gd.Board.WriteTo(w)

	return wrote, nil
}

// ReadFrom is a deserialization function
func (gd *GameData) ReadFrom(r io.Reader) (int64, error) {
	var read int64
	if v, n, err := util.ReadUint64(r); err != nil {
		return read, err
	} else {
		read += n
		gd.Count = v
	}

	if bs, n, err := util.ReadBytes(r); err != nil {
		panic(err)
		return read, err
	} else {
		var buffer PictureBoard
		decoder := gob.NewDecoder(bytes.NewReader(bs))
		err := decoder.Decode(&buffer)
		if err != nil {
			panic(err)
		}
		gd.Board = buffer
		read += n
	}

	return read, nil
}

//////////////////////////////////////////////////////////////////////
// Sandbox Area End
//////////////////////////////////////////////////////////////////////
