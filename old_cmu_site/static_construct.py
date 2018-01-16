#! /usr/local/bin/python
import os, sys, string

def print_file(funcs):
	# extern prototypes
	print 'extern "C" {'
	for func in funcs:
		print '/* from', func[0], '*/'
		print 'void', func[1] + '(void);'
		print
	print '} /* end of extern "C" */'
	print

	# one function that calls all the constructors
	print 'void static_construct(void) {'
	for func in funcs:
		print '    ' + func[1] + '();'
	print '}'

def get_funcs():
	funcs = []
	for filename in sys.argv[1:]:
		cmd = 'nm -B ' + filename + ' | grep __sti__'
		syscall = os.popen(cmd, "r")
		line = syscall.readline()
		while line:
			if len(line) > 0:
				words = string.split(line)
				func = words[2]
				funcs.append((filename, func))
			line = syscall.readline()
	return funcs

###############################################################

funcs = get_funcs()
print_file(funcs)
