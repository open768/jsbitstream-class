'use strict'
/**
 * added for convenience as used throghout this code but was not defined
 */
function left_pad(str, length, pad_char) {
	return str.padStart(length, pad_char)
}

class bitstreamTypes{
	static TYPE_4BIT_NUMERIC = 5
	static TYPE_5BIT_LOWERCASE = 4
	static TYPE_6BIT_ALPHANUMERIC = 3
	static TYPE_7BIT_LOW_ASCII = 2
	static TYPE_8BIT_ASCII = 1
	static TYPE_16BIT_UNICODE = 0
}

/**
 * jsbitstream is a Javascript class to read and write bit level data into and out of a stream.
 * It was created to preserve as many bits and bytes during network communication as possible without sacrificing
 * speed (ie. through compression). It was intended to prepare network packets for multiplayer HTML5 games.
 *
 * @class
 * @name jsbitstream
 * @author Konrad Kiss
 * @copyright Copyright � 2012 Konrad Kiss and modifications ©️ 2026 Sunil Vanmullem cluck@chickenkatsu.co.uk
 * @license MIT License (see LICENSE.txt)
 * @version 1.1 - converted to a class by Sunil Vanmullem
 */
class jsbitstream {
	data = ""
	bitOffset = 0
	lastCharBits = 0
	_backup = null

	//**********************************************************************
	//* additions by SV
	//**********************************************************************
	reset_offset(){
		this.bitOffset = 0
		this.lastCharBits = 0
	}

	backup_data(){
		this._backup = this.data
	}

	restore_data( pbDeleteBackup = false ){
		if (!this._backup == null)
			throw new Error("No backup data to restore")

		this.data = this._backup
		this.reset_offset()

		if (pbDeleteBackup)
			this._backup = null
	}

	//**********************************************************************
	//* end of additions by SV
	//**********************************************************************

	//******** STRING **************************************************************
	/**
	 *
	 * @returns {String} The string read from the bitstream.
	 */
	readString() {
		var typeId = this.readU4(),
			l = this.readU16(),
			txt = "",
			c

		while (l--) {
			switch (typeId) {
				case bitstreamTypes.TYPE_4BIT_NUMERIC: // numeric 4 bit
					c = this.readBits(4).data.charCodeAt(0) >> 12
					if (c === 4)
						c = 32
					else
						c += 43

					break
				case bitstreamTypes.TYPE_5BIT_LOWERCASE: // lowercase alpha 5 bit
					c = this.readBits(5).data.charCodeAt(0) >> 11
					if (c === 26) // space
						c = 32
					else if (c === 27) // |
						c = 124
					else if (c === 28) // '
						c = 39
					else if (c === 29) // -
						c = 45
					else if (c === 30) // .
						c = 46
					else if (c === 31) // ,
						c = 44
					else
						c += 97 // a-z

					break
				case bitstreamTypes.TYPE_6BIT_ALPHANUMERIC: // alphanumeric 6 bit
					c = this.readBits(6).data.charCodeAt(0) >> 10
					if (c === 62) // ,
						c = 44
					else if (c === 63) // space
						c = 32
					else {
						c += 48
						if (c >= 58)
							c += 7

						if (c >= 91)
							c += 6

					}

					break
				case bitstreamTypes.TYPE_7BIT_LOW_ASCII: // low ascii 7 bit
					c = this.readBits(7).data.charCodeAt(0) >> 9
					break
				case bitstreamTypes.TYPE_8BIT_ASCII: // ascii 8 bit
					c = this.readBits(8).data.charCodeAt(0) >> 8
					break
				default: // unicode
					c = this.readBits(16).data.charCodeAt(0)
					break
			}

			txt += String.fromCharCode(c)
		}

		return txt
	}

	/**
	 * Writes an arbitrary string into the bitstream.
	 * @public
	 * @param val (string) The string value to be written.
	 * @param lowerCase (boolean) Shows whether the string can be represented in a lower case format.
	 *                            Defaults to false. A full lowercase string takes less bits in the bitstream.
	 * @return {String} The string that was inserted into the bitstream.
	 */
	writeString(val, lowerCase) {


		if (lowerCase === undefined)
			lowerCase = false


		if (lowerCase)
			val = val.toLowerCase()


		var numericOnly = true,
			lowerCaseCharactersOnly = true,
			alphanumericOnly = true,
			lowASCIIOnly = true,
			asciiOnly = true,
			typeId,
			c,
			t

		for (t = 0; t < val.length; t++) {
			c = val.charCodeAt(t)
			if ((c < 43 || c > 57 || c === 47) && c !== 32)
				numericOnly = false
			// includes: +,-.space

			if ((c < 97 || c > 122) && c !== 32 && c !== 124 && c !== 39 && c !== 46 && c !== 44)
				lowerCaseCharactersOnly = false
			// includes '|-., and space

			if ((c < 48 || c > 57) && (c < 65 || c > 90) && (c < 97 || c > 122) && (c !== 32 && c !== 39))
				alphanumericOnly = false
			// includes , and space

			if (c > 127)
				lowASCIIOnly = false

			if (c > 255)
				asciiOnly = false

		}

		typeId = (numericOnly ? 5 : (lowerCaseCharactersOnly ? 4 : (alphanumericOnly ? 3 : (lowASCIIOnly ? 2 : (asciiOnly ? 1 : 0))))) & 0x000F

		this.writeU4(typeId)
		this.writeU16(val.length)

		for (t = 0; t < val.length; t++) {
			c = val.charCodeAt(t)
			switch (typeId) {
				case bitstreamTypes.TYPE_4BIT_NUMERIC: // 5 - numeric only (4 bits) (0-15) - includes: +,-.space
					if (c === 32)
						c = 4 // space instead of /
					else
						c -= 43

					this.writeBits(String.fromCharCode((c << 12) & 0xF000), 4)
					break
				case bitstreamTypes.TYPE_5BIT_LOWERCASE: // 4 - lowercase alpha only (5 bits) (0-31) - includes space|'-.,
					if (c === 32) // space
						c = 26
					else if (c === 124) // |
						c = 27
					else if (c === 39) // '
						c = 28
					else if (c === 45) // -
						c = 29
					else if (c === 46) // .
						c = 30
					else if (c === 44) // ,
						c = 31
					else
						c -= 97 // a-z

					this.writeBits(String.fromCharCode((c << 11) & 0xF800), 5)
					break
				case bitstreamTypes.TYPE_6BIT_ALPHANUMERIC: // 3 - alphanumeric only (6 bits) (0-63) - includes , and space
					if (c === 44) // ,
						c = 62
					else if (c === 32) // space
						c = 63
					else {
						c -= 48
						if (c >= 17)
							c -= 7

						if (c >= 42)
							c -= 6

					}

					this.writeBits(String.fromCharCode((c << 10) & 0xFC00), 6)
					break
				case bitstreamTypes.TYPE_7BIT_LOW_ASCII: // 2 - low ascii only (7 bit) (0-127)
					this.writeBits(String.fromCharCode((c << 9) & 0xFE00), 7)
					break
				case bitstreamTypes.TYPE_8BIT_ASCII: // 1 - ascii only (8 bits)
					this.writeBits(String.fromCharCode((c << 8) & 0xFF00), 8)
					break
				default: // 0 - unicode (16 bits)
					this.writeBits(String.fromCharCode(c & 0xFFFF), 16)
					break
			}
		}

		return val
	}

	//******** Int **************************************************************
	/**
	 * Reads a compressed integer from the bitstream. Useful for numbers where small (<256) and
	 * large (>65536 or >4294967296) values fluctuate.
	 * @public
	 * @return {Number|String} The integer read from the bitstream. For small numbers, this is a number, for large numbers
	 *                         this is a string.
	 */
	readInt() {


		if (this.readFlag()) // 8 bit?
			return this.readU8()

		if (this.readFlag()) // 16 bit ?
			return this.readU16()

		if (this.readFlag()) // 32 bit ?
			return this.readU32()

		// large value
		return this.readString()
	}

	/**
	 * Writes a compressed integer into the bitstream. Use for numbers where small (<256)
	 * and large (>65536 or >4294967296) values fluctuate.
	 * @public
	 * @param val The number to be written into the bitstream. For extremely large values, this is treated as a string.
	 * @return {Number|String} The value written into the bitstream.
	 */
	writeInt(val) {


		val *= 1
		if (this.writeFlag(val < Math.pow(2, 8))) // 8 bit
			this.writeU8(val)
		else if (this.writeFlag(val < Math.pow(2, 16))) // 16 bit
			this.writeU16(val)
		else if (this.writeFlag(val < Math.pow(2, 32))) // 32 bit
			this.writeU32(val)
		else // large value
			this.writeString(val.toString(), false)


		return val
	}

	//******** FLOAT **************************************************************
	/**
	 * Reads a relative float (0-1) value from the bitstream with 8 bit precision.
	 * @public
	 * @return {Number} The number read from the bitstream. Note that this number will have a difference of up to 0.008.
	 */
	readFloat() {


		return (this.readU8() & 0xFF) / 255
	}

	/**
	 * Writes a relative float (0-1) value into the bitstream with 8 bit precision.
	 * @public
	 * @param val_float The value to be written into the bitstream. The value must be between 0 and 1 (inclusive).
	 * @return {Number} The number written into the bitstream (not the number passed as the original argument).
	 */
	writeFloat(val_float) {


		val_float = (val_float * 255) & 0xFF
		this.writeU8(val_float)
		return val_float
	}

	//******** U32 **************************************************************
	/**
	 * Reads a 32 bit value from the bitstream.
	 * @public
	 * @return {Number} The 32 bit number read from the bitstream.
	 */
	readU32() {


		var readStr = this.readBits(32).data.toString()
		return (readStr.charCodeAt(0) & 0xFFFF) * 0x10000 + (readStr.charCodeAt(1) & 0xFFFF)
	}

	/**
	 * Writes a 32 bit value into the bitstream.
	 * @public
	 * @param val_u32 The number (32 bits) to be written into the bitstream.
	 * @return {Number} The original number passed as an argument.
	 */
	writeU32(val_u32) {


		this.writeBits(String.fromCharCode(val_u32 >> 16 & 0xFFFF) + String.fromCharCode(val_u32 & 0xFFFF), 32)
		return val_u32
	}

	//******** U16  **************************************************************
	/**
	 * Reads a 16 bit number from the bitstream.
	 * @public
	 * @return {Number} The 16 bit number read from the bitstream.
	 */
	readU16() {


		return (this.readBits(16).data.toString()).charCodeAt(0) & 0xFFFF
	}

	/**
	 * Writes a 16 bit value into the bitstream.
	 * @public
	 * @param val_u16 The number (16 bits) to be written into the bitstream.
	 * @return {Number} The original number passed as an argument.
	 */
	writeU16(val_u16) {


		this.writeBits(String.fromCharCode(val_u16 & 0xFFFF), 16)
		return val_u16
	}

	//******** U8  **************************************************************
	/**
	 * Reads a byte (8 bits) from the bitstream.
	 * @public
	 * @return {Number} The 8 bit number read from the bitstream.
	 */
	readU8() {


		return ((this.readBits(8).data.toString()).charCodeAt(0) & 0xFF00) >> 8
	}

	/**
	 * Writes a byte (8 bits) value into the bitstream.
	 * @public
	 * @param val_u8 The number (8 bits) to be written into the bitstream.
	 * @return {Number} The original number passed as an argument.
	 */
	writeU8(val_u8) {


		this.writeBits(String.fromCharCode((val_u8 & 0xFF) * 0x100), 8)
		return val_u8
	}

	/**
	 * Reads a half-byte (4 bits) from the bitstream.
	 * @public
	 * @return {Number} The 4 bit number read from the bitstream.
	 */

	//******** U16  **************************************************************
	readU4() {


		return ((this.readBits(4).data.toString()).charCodeAt(0) & 0xF000) >> 12
	}

	/**
	 * Writes a half-byte (4 bits) value into the bitstream.
	 * @public
	 * @param val_u4 The number (4 bits) to be written into the bitstream.
	 * @return {Number} The original number passed as an argument.
	 */
	writeU4(val_u4) {


		this.writeBits(String.fromCharCode((val_u4 & 0x0F) * 0x1000), 4)
		return val_u4
	}

	//******** UBits  **************************************************************
	/**
	 * Reads an arbitrary-length unsigned number from the bitstream.
	 * reads the most significant bit first
	 * @public
	 * @param piBitLen {Number} The number of bits to read (1-max safe Number bits).
	 * @return {Number} The unsigned number read from the bitstream.
	 */

	readUBits(piBitLen) {

		var maxSafeBits = cCommon.intBitSize(Number.MAX_SAFE_INTEGER) + 1

		if (piBitLen < 1 || piBitLen > maxSafeBits)
			throw new RangeError("readUBits(count) supports bit counts from 1 to " + maxSafeBits + "")


		var value = 0
		var bit
		var i


		for (i = 0; i < piBitLen; i++) {
			bit = this.readFlag() ? 1 : 0
			value = (value << 1) | bit
		}

		return Number(value)
	}

	/**
	 * reverse bits of an arbitrary-length unsigned number.
	 * @public
	 * @param {number} piNum The unsigned number to reverse bits for.
	 * @param {number} piBitLen The number of bits .
	 * @return {number} 
	 */
	_reverseBits(piNum, piBitLen) {
		var iRev = 0 //contains reversed number
		
		var iLSB	//least significant bit
		for (var i = 0; i < piBitLen; i++) {
			iLSB = (piNum >> i) & 1
			iRev = iRev | iLSB
			iRev = iRev << 1
		}
		return iRev
	}
	
	/**
	 * writes an arbitrary-length unsigned number into the bitstream.
	 * @public
	 * @param {number} piNum The unsigned number to write.
	 * @param {number} piBitLen The number of bits .
	 * @return {void} 
	 */
	writeUBits(piNum, piBitLen) {
		//reverse the number so that its most significant bit is written first later
		var iRev = this._reverseBits(piNum, piBitLen)

		//write out reversed bits
		for (var j = 0; j < piBitLen; j++) {
			this.writeFlag((iRev & 1) === 1)
			iRev = iRev	 >> 1
		}
	}

	//******** FLAG  **************************************************************
	/**
	 * Reads a boolean value from the bitstream.
	 * @public
	 * @return {Boolean} The boolean value read from the bitstream.
	 */
	readFlag() {


		return ((this.readBits(1).data.toString()).charCodeAt(0) & 0x8000) === 0x8000
	}

	/**
	 * Writes a boolean value into the bitstream.
	 * @public
	 * @param val_boolean The boolean value to be written into the bitstream.
	 * @return {Boolean} The original boolean value passed as an argument.
	 */
	writeFlag(val_boolean) {


		this.writeBits(val_boolean ? String.fromCharCode(0x8000) : String.fromCharCode(0x0000), 1)
		return val_boolean
	}

	//******** Bits  **************************************************************
	/**
	 * Reads an arbitrary amount of bits and returns it as a jsbitstream object. This always reads from bitOffset. The
	 * final portion of the stream that was read is then shifted to have a 0 offset before converting to a type.
	 * @private
	 * @param count The number of bits to be read from the bitstream.
	 * @return {jsbitstream} The jsbitstream object representing the bits read.
	 */
	readBits(count) {


		if (this.size() < count)
			count = this.size()


		// TODO: does this work with node?
		var readStream = new jsbitstream(),
			toReadCount,
			firstChar = ""


		if (this.bitOffset > 0) {
			toReadCount = Math.min(16 - this.bitOffset, count)

			// copy the first character using only valid bits
			//@ts-expect-error
			firstChar = ((this.data.charCodeAt(0) << this.bitOffset) & ((Math.pow(2, toReadCount) - 1) << (16 - toReadCount)))


			//@ts-expect-error
			readStream.writeBits(String.fromCharCode(firstChar), toReadCount)

			this.bitOffset = (this.bitOffset + toReadCount) % 16
			if (this.bitOffset === 0)
				this.data = this.data.substr(1)


			count -= toReadCount
		}

		while (count > 0) {
			toReadCount = Math.min(16, count)

			readStream.writeBits(String.fromCharCode((this.data.charCodeAt(0) & ((Math.pow(2, toReadCount) - 1) << (16 - toReadCount)))), toReadCount)

			if (toReadCount < 16)
			// the read ends in this character with a non-zero bitOffset
				this.bitOffset = toReadCount
			else
			// the read ends with the last bit or goes on in the next character
				this.data = this.data.substr(1)


			count -= toReadCount
		}

		// clean up if no data is left in the stream
		if (this.size() === 0) {
			this.data = ""
			this.bitOffset = 0
			this.lastCharBits = 0
		}

		return readStream
	}

	/**
	 * Writes an arbitrary amount of bits into the stream.
	 * @private
	 * @param writeBuffer {String} A bit packed string containing the value to be written.
	 * @param bitCount {Number} The number of bits to write. Must be equal or less than 16 * the number of characters in
	 *                          writeBuffer.
	 */
	writeBits(writeBuffer, bitCount) {


		bitCount = Math.min(bitCount, writeBuffer.length * 16)

		var writeBufferPointer = 0,
			bitsToRead,
			writeValue,
			targetOffset,
			targetValue,
			firstBitsToWrite,
			firstValue,
			nextBitsToWrite,
			nextValue

		while (writeBufferPointer < bitCount) {
		// get at most 16 bits and add them as a new character
		// read the buffer to write (writeBuffer) up to the end of the current character or to the end of the string (bitCount)
			bitsToRead = Math.min(Math.min(16, (bitCount - writeBufferPointer)), 16 - (writeBufferPointer % 16))
			// this is the value we need to write - masked out from the source character and shifted to the right
			writeValue = (writeBuffer.charCodeAt(writeBufferPointer / 16 >> 0) >> (16 - bitsToRead)) & (Math.pow(2, bitsToRead) - 1)
			// this is the character we're writing to
			targetOffset = Math.max(this.data.length - 1 + (this.lastCharBits === 0 ? 1 : 0), 0)

			if (this.data.length - 1 < targetOffset)
				this.data += "\u0000"


			firstBitsToWrite = Math.min(16 - this.lastCharBits, bitsToRead)
			firstValue = writeValue >> (bitsToRead - firstBitsToWrite)
			nextBitsToWrite = bitsToRead - firstBitsToWrite
			nextValue = writeValue & (Math.pow(2, nextBitsToWrite) - 1)

			// mask out any bits following the last write from the target value
			// add the new value shifted to the target position
			// and copy it into the target stream's last character
			targetValue = this.data.charCodeAt(targetOffset) & 0xFFFF
			targetValue &= ((Math.pow(2, this.lastCharBits) - 1) << (16 - this.lastCharBits))
			targetValue |= firstValue << (16 - (this.lastCharBits + firstBitsToWrite))
			this.data = this.data.substr(0, targetOffset) + String.fromCharCode(targetValue & 0xFFFF)

			if (nextBitsToWrite > 0) {
				// the value to be written has overflown the target character
				// add a new zero character at the end of the stream
				// and shift the remaining bits that need to be written all the way to the left
				// before writing it into the stream's new character
				this.data += "\u0000"
				targetValue = nextValue << (16 - nextBitsToWrite)
				this.data = this.data.substr(0, targetOffset + 1) + String.fromCharCode(targetValue & 0xFFFF)
			}

			this.lastCharBits = (this.lastCharBits + bitsToRead) % 16
			writeBufferPointer += bitsToRead

			this.lastBitsAdded = bitsToRead
		}
	}

	//**********************************************************************
	// UTILS
	//**********************************************************************
	/**
	 * Returns the number of bits within the stream.
	 * @return {Number} teh number of bits within the stream.
	 */
	size() {
		var iVal = (this.data.length * 16) - this.bitOffset - ((16 - this.lastCharBits) % 16)
		return iVal
	}


}
