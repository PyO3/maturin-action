#[pyo3::pymodule]
mod pyo3_pure {
    use pyo3::prelude::*;

    #[pyclass]
    struct DummyClass {}

    #[pymethods]
    impl DummyClass {
        #[staticmethod]
        fn get_42() -> PyResult<usize> {
            Ok(42)
        }
    }

    #[pymodule_export]
    #[allow(non_upper_case_globals)]
    const fourtytwo: u8 = 42;
}