import { Command } from '@commander-js/extra-typings'
import { expect, test } from 'vitest'

import { registerMcpDoctorCommand } from './doctorCommand.js'

test('registerMcpDoctorCommand adds the doctor subcommand with expected options', () => {
	const mcp = new Command('mcp')

	registerMcpDoctorCommand(mcp)

	const doctor = mcp.commands.find((command) => command.name() === 'doctor')
	expect(doctor).toBeTruthy()
	expect(doctor?.usage()).toBe('[options] [name]')

	const optionFlags = doctor?.options.map((option) => option.long)
	expect(optionFlags).toEqual(['--scope', '--config-only', '--json'])
})
