type FileUploadProps = {
    selectedFile: File | null;
    onFileSelect: (file: File) => void;
    onFileClear: () => void;
    onError: (message: string) => void;
    disabled?: boolean;
};
export const FileUpload = ({ selectedFile, onFileSelect, onFileClear, onError, disabled }: FileUploadProps) => {
    const handleFileChange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) {
                onError("File size must be less than 100MB");
                return;
            }
            onFileSelect(file);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-4">
                <h3 className="text-2xl font-semibold text-white">Upload Your Video</h3>
                <p className="text-gray-300 text-lg">Drag & drop or click to select your video file</p>
            </div>

            {!selectedFile ? (
                <label className={`group relative block w-full rounded-2xl border-2 border-dashed transition-all duration-300 ${disabled
                    ? 'border-gray-600 cursor-not-allowed opacity-50'
                    : 'border-indigo-400/40 hover:border-indigo-400/80 cursor-pointer hover:bg-indigo-500/10'
                    } p-12`}>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        disabled={disabled}
                        className="sr-only"
                    />
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors duration-300">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xl font-semibold text-white group-hover:text-indigo-300 transition-colors">
                                Choose a video file
                            </p>
                            <p className="text-gray-400 mt-2">MP4, AVI, MOV up to 100MB</p>
                        </div>
                    </div>
                </label>
            ) : (
                <div className="relative rounded-2xl bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 border border-emerald-400/40 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-white truncate max-w-xs">{selectedFile.name}</p>
                                <p className="text-sm text-gray-300">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                            </div>
                        </div>
                        <button
                            onClick={onFileClear}
                            disabled={disabled}
                            className="p-2 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/10 via-transparent to-indigo-400/10 animate-pulse"></div>
                </div>
            )}
        </div>
    );
};